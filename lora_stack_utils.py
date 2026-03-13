from . import utils

# wildcard trick is taken from pythongossss's
class AnyType(str):
    def __ne__(self, __value: object) -> bool:
        return False

ANY_TYPE = AnyType("*")

class GetNameForLoraStack:

    def __init__(self):
        pass

    @classmethod
    def INPUT_TYPES(cls):

        return {
            "required": {
                "lora_stack": ("LORA_STACK",),
            }
        }

    TITLE="Get Name For LoRA Stack"
    RETURN_TYPES = (ANY_TYPE,)
    RETURN_NAMES = ("nameBatch",)
    OUTPUT_IS_LIST = (True,)
    FUNCTION = "run"
    CATEGORY = "text_utils_sp"

    def run(self,lora_stack:list):

        def ifArr(x):
            if isinstance(x, list) and isinstance(x[0], list):  # x がリストのリストの場合
                return (item[0] for item in x)  # 各サブリストの最初の要素を取り出す

            elif isinstance(x, list):  # x がリストの場合
                return (item[0] for item in x)

            else:  # x がリストでもリストのリストでもない場合
                return (x[0]) # xをリストに入れて返す

        nameArr=tuple(ifArr(lora_stack))

        return (nameArr,)

#---------------------------------------------------------------

class SelectLists:

    def __init__(self):
        pass

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "ANY": (ANY_TYPE, {"forceInput": True}),
            },
            "optional": {
                "toggle_states_json": ("STRING", {"default": "{}"}),
            },
            "hidden": {
                "unique_id": "UNIQUE_ID",
            }
        }

    TITLE="SelectLists"
    RETURN_TYPES = (ANY_TYPE, "STRING",)
    RETURN_NAMES = ("list", "text",)
    OUTPUT_IS_LIST = (True, False)
    INPUT_IS_LIST = True
    FUNCTION = "run"
    CATEGORY = "text_utils_sp"
    OUTPUT_NODE = True

    @classmethod
    def IS_CHANGED(cls, ANY, unique_id=None, toggle_states_json=None):
        import hashlib
        import json
        m = hashlib.sha256()
        m.update(str(ANY).encode("utf-8"))
        
        if toggle_states_json:
            tsj = toggle_states_json[0] if isinstance(toggle_states_json, list) else toggle_states_json
            m.update(str(tsj).encode("utf-8"))
            
        return m.hexdigest()

    def run(self, ANY:list, unique_id=None, toggle_states_json=None):
        import json
        
        display_items = []
        
        def get_preview(item):
            if isinstance(item, str):
                return item
            elif isinstance(item, (list, tuple)):
                res = []
                for x in item:
                    res.append(get_preview(x))
                return ",\n".join(res)
            else:
                return str(item)

        for item in ANY:
            preview = get_preview(item)
            display_items.append(preview)
            
        uid = str(unique_id[0]) if isinstance(unique_id, list) else str(unique_id)
        states = {}
        
        if toggle_states_json:
            tsj = toggle_states_json[0] if isinstance(toggle_states_json, list) else toggle_states_json
            try:
                parsed = json.loads(tsj)
                if isinstance(parsed, dict) and len(parsed) > 0:
                    states = parsed
            except (json.JSONDecodeError, TypeError):
                pass
                
        if not states:
            states = _select_texts_store.get(uid, {})
            
        # 選択されているリスト単位（ON）のみを抽出する
        included_units = []
        for i, item in enumerate(ANY):
            key = str(i)
            if states.get(key, True):  # デフォルトはTrue（ON）
                included_units.append(item)
                
        if included_units:
            # 元の処理と同じようにフラット化してカンマ区切りで結合
            mergeList = utils.convert_array(included_units)
            result = ", ".join([str(v) for v in mergeList])
        else:
            mergeList = [] #未選択時にエラーになるのを防ぐため
            result = ""

        print(f"\n[SelectLists] : {mergeList}\n")

        # UI更新用のデータと実際の出力データの両方を返す
        return {"ui": {
                    "text_list": display_items, 
                    "display_groups": [json.dumps([display_items])],
                    "toggle_states": [json.dumps(states)],
                    "result_text": [""],
                    "is_excluded_mode": [True]
                },
                "result": (mergeList, result)}

#---------------------------------------------------------------

import json
from server import PromptServer
from aiohttp import web

# サーバーサイドストア: ノードIDごとのトグル状態を保持
_select_texts_store = {}

@PromptServer.instance.routes.post("/select_texts/set_states")
async def _set_states(request):
    """JS側からトグル状態を受け取り、サーバーメモリに保存"""
    data = await request.json()
    node_id = str(data.get("node_id", ""))
    states = data.get("states", {})
    _select_texts_store[node_id] = states
    return web.json_response({"ok": True})

@PromptServer.instance.routes.get("/select_texts/get_states/{node_id}")
async def _get_states(request):
    """指定ノードIDのトグル状態を返す"""
    node_id = request.match_info["node_id"]
    states = _select_texts_store.get(node_id, {})
    return web.json_response({"states": states})

import re

class SelectTexts:
    """
    リストまたはカンマ区切り文字列を受け取り、各テキストをトグルボタンとして
    UI上に表示。ユーザーがON/OFFを切り替え、ONのテキストのみカンマ区切りで出力する。
    入れ子の強調構文 (zzz,(aaa,bbb:0.5):0.4) に対応。
    """

    def __init__(self):
        pass

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "ANY": (ANY_TYPE, {"forceInput": True}),
            },
            "optional": {
                "toggle_states_json": ("STRING", {"default": "{}"}),
            },
            "hidden": {
                "unique_id": "UNIQUE_ID",
            }
        }

    TITLE = "Select Texts"
    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("selected",)
    INPUT_IS_LIST = True
    FUNCTION = "run"
    CATEGORY = "text_utils_sp"
    OUTPUT_NODE = True

    @classmethod
    def IS_CHANGED(cls, ANY, unique_id=None, toggle_states_json=None):
        import hashlib
        import json
        m = hashlib.sha256()
        
        # ANYの変動を監視
        m.update(str(ANY).encode("utf-8"))
        
        # トグル状態の変動を監視
        if toggle_states_json:
            tsj = toggle_states_json[0] if isinstance(toggle_states_json, list) else toggle_states_json
            m.update(str(tsj).encode("utf-8"))
            
        return m.hexdigest()

    # --------------------------------------------------
    # 再帰的プロンプトパーサー
    # --------------------------------------------------

    @staticmethod
    def _parse_prompt(text):
        """トップレベルのカンマ区切りトークンを解析（括弧の入れ子を考慮）"""
        groups = []
        pos = 0
        length = len(text)

        while pos < length:
            # 空白スキップ
            while pos < length and text[pos] in ' \t':
                pos += 1
            if pos >= length:
                break

            c = text[pos]

            if c == '(':
                group, pos = SelectTexts._parse_group(text, pos)
                groups.append(group)
            elif c == ',':
                pos += 1
            else:
                # プレーンテキスト（カンマ・括弧まで）
                end = pos
                while end < length and text[end] not in ',()':
                    end += 1
                token = text[pos:end].strip()
                if token:
                    groups.append({"type": "plain", "items": [token]})
                pos = end

        return groups

    @staticmethod
    def _parse_group(text, pos):
        """
        位置posの(から始まるグループを解析（入れ子対応）。
        (zzz,(aaa,bbb:0.5):0.4) → weighted, inner=[zzz, weighted[aaa,bbb]], weight=0.4
        """
        pos += 1  # '(' をスキップ

        # マッチする閉じ括弧を探す
        depth = 1
        start = pos
        while pos < len(text) and depth > 0:
            if text[pos] == '(':
                depth += 1
            elif text[pos] == ')':
                depth -= 1
            pos += 1

        # 括弧の中身を抽出
        inner = text[start:pos - 1]

        # 最後のトップレベル : を探してウェイトを抽出
        weight = None
        d = 0
        last_colon = -1
        for i, c in enumerate(inner):
            if c == '(':
                d += 1
            elif c == ')':
                d -= 1
            elif c == ':' and d == 0:
                last_colon = i

        if last_colon >= 0:
            pw = inner[last_colon + 1:].strip()
            try:
                float(pw)
                weight = pw
                inner = inner[:last_colon]
            except ValueError:
                pass

        # 中身を再帰的にパース
        inner_groups = SelectTexts._parse_prompt(inner)

        return {"type": "weighted", "inner_groups": inner_groups, "weight": weight}, pos

    @staticmethod
    def _get_display_items(groups):
        """グループ構造からリーフアイテム（括弧なし）を再帰的に抽出"""
        items = []
        for g in groups:
            if g["type"] == "plain":
                items.extend(g["items"])
            elif g["type"] == "weighted":
                items.extend(SelectTexts._get_display_items(g["inner_groups"]))
        return items

    @staticmethod
    def _reconstruct(groups, states):
        """グループ構造とトグル状態からプロンプトを再構築（入れ子対応）"""
        parts = []
        for g in groups:
            if g["type"] == "plain":
                item = g["items"][0]
                if states.get(item, True):
                    parts.append(item)
            elif g["type"] == "weighted":
                # 再帰的に内部を再構築
                inner_result = SelectTexts._reconstruct(g["inner_groups"], states)
                if inner_result:  # 内部に1つでもONがあれば括弧を維持
                    if g["weight"]:
                        parts.append(f"({inner_result}:{g['weight']})")
                    else:
                        parts.append(f"({inner_result})")
                # 全てOFFなら括弧ごとスキップ
        return ", ".join(parts)

    def run(self, ANY, unique_id=None, toggle_states_json=None):
        raw_parts = []
        display_groups = []

        is_nested = isinstance(ANY, list) and len(ANY) > 0 and isinstance(ANY[0], list)
        
        if is_nested:
            # [[text1, text2], [text3, text4]] のような入力
            for sublist in ANY:
                group_parts = []
                for item in sublist:
                    text = str(item).strip()
                    raw_parts.append(text)
                    group_parts.append(text)
                group_text = ", ".join(group_parts)
                group_groups = self._parse_prompt(group_text)
                group_display_items = self._get_display_items(group_groups)
                if group_display_items:
                    display_groups.append(group_display_items)
        else:
            # [text1, text2] のような入力
            for item in ANY:
                text = str(item).strip()
                raw_parts.append(text)
            
            raw_text = ", ".join(raw_parts)
            groups = self._parse_prompt(raw_text)
            display_items = self._get_display_items(groups)
            if display_items:
                display_groups.append(display_items)

        raw_text = ", ".join(raw_parts)

        # 再帰パーサーで全体のグループ構造を取得 (再構築用)
        groups = self._parse_prompt(raw_text)

        # 表示用全体のアイテムリスト
        display_items = self._get_display_items(groups)

        # トグル状態を取得（プロンプト内のJSON → サーバーストア → 空dictの優先順位）
        uid = str(unique_id[0]) if isinstance(unique_id, list) else str(unique_id)
        states = {}
        
        # まずプロンプトに含まれるtoggle_states_jsonから読み取る（最も信頼性が高い）
        if toggle_states_json:
            tsj = toggle_states_json[0] if isinstance(toggle_states_json, list) else toggle_states_json
            try:
                parsed = json.loads(tsj)
                if isinstance(parsed, dict) and len(parsed) > 0:
                    states = parsed
            except (json.JSONDecodeError, TypeError):
                pass
        
        # フォールバック: サーバーサイドストアから取得
        if not states:
            states = _select_texts_store.get(uid, {})

        # グループ構造を考慮して出力を再構築
        result = self._reconstruct(groups, states)

        print(f"[{self.TITLE}] INPUT ANY: {ANY}")
        print(f"[{self.TITLE}] RECEIVED STATES: {states}")
        print(f"[{self.TITLE}] RESULT: {result}")
        # UI側にテキストリスト（表示用）と状態、さらにグループ構造を送信
        return {"ui": {
                    "text_list": display_items, 
                    "display_groups": [json.dumps(display_groups)],
                    "toggle_states": [json.dumps(states)],
                    "result_text": [result]
                },
                "result": (result,)}


NODE_CLASS_MAPPINGS = {
    "GetNameForLoraStack": GetNameForLoraStack,
    "SelectLists": SelectLists,
    "SelectTexts": SelectTexts,
}
