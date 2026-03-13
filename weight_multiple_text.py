from . import utils

class weight3xText:

    def __init__(self):
        self.combined_text=""

    @classmethod
    def INPUT_TYPES(cls):
        weight_settings = {
            "default": 1,
            "min": utils.WEIGHT_MIN,
            "max": utils.WEIGHT_MAX,
            "step": utils.WEIGHT_STEP,
            "display": utils.WEIGHT_DISPLAY
        }
        txtArea_settings={
            "multiline": True
        }

        return {
            "required": {
                "text_1": ("STRING", txtArea_settings),
                "weight_1": ("FLOAT", weight_settings),
                "text_2": ("STRING", txtArea_settings),
                "weight_2": ("FLOAT", weight_settings),
                "text_3": ("STRING", txtArea_settings),
                "weight_3": ("FLOAT", weight_settings),
            }
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("text",)
    FUNCTION = "run"
    CATEGORY = "text_utils_sp"

    def run(
            self,
            text_1="", weight_1=0,
            text_2="", weight_2=0,
            text_3="", weight_3=0,
            ):

        texts=[]
        inputs = [(text_1, weight_1), (text_2, weight_2), (text_3, weight_3)]

        for text, weight in inputs:
            if text != "" and weight > 0:
                texts.append(utils.apply_weight(text, weight))


        texts = ", ".join(filter(None, texts))
        texts = texts.rstrip(", ")
        self.combined_text=texts
        print(f"Text preview: {self.combined_text}")
        return (texts,self.combined_text)



class weightMultiText:
    """テキスト入力数を動的に増減できるウェイト付きテキスト結合ノード"""

    MAX_INPUTS = 20

    def __init__(self):
        self.combined_text = ""

    @classmethod
    def INPUT_TYPES(cls):
        weight_settings = {
            "default": 1,
            "min": utils.WEIGHT_MIN,
            "max": utils.WEIGHT_MAX,
            "step": utils.WEIGHT_STEP,
            "display": utils.WEIGHT_DISPLAY
        }
        txtArea_settings = {
            "multiline": True
        }

        # text_2〜text_20, weight_2〜weight_20 をoptionalとして定義
        # （JSフロントエンドでshow/hideを制御する）
        optional = {}
        for i in range(2, cls.MAX_INPUTS + 1):
            optional[f"text_{i}"] = ("STRING", txtArea_settings)
            optional[f"weight_{i}"] = ("FLOAT", weight_settings)

        return {
            "required": {
                "text_count": ("INT", {"default": 1, "min": 1, "max": cls.MAX_INPUTS}),
                "text_1": ("STRING", txtArea_settings),
                "weight_1": ("FLOAT", weight_settings),
            },
            "optional": optional,
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("text",)
    FUNCTION = "run"
    CATEGORY = "text_utils_sp"

    def run(self, text_count=1, **kwargs):
        texts = []

        for i in range(1, text_count + 1):
            text = kwargs.get(f"text_{i}", "")
            weight = kwargs.get(f"weight_{i}", 1.0)
            if text != "" and weight > 0:
                texts.append(utils.apply_weight(text, weight))

        result = ", ".join(filter(None, texts))
        result = result.rstrip(", ")
        self.combined_text = result
        print(f"WeightMultiText preview: {self.combined_text}")
        return (result,)


class multiText:
    """テキスト入力数を動的に増減できるシンプルなテキスト結合ノード"""

    MAX_INPUTS = 20

    def __init__(self):
        self.combined_text = ""

    @classmethod
    def INPUT_TYPES(cls):
        txtArea_settings = {
            "multiline": True
        }

        # text_2〜text_20 をoptionalとして定義
        # （JSフロントエンドでshow/hideを制御する）
        optional = {}
        for i in range(2, cls.MAX_INPUTS + 1):
            optional[f"text_{i}"] = ("STRING", txtArea_settings)

        return {
            "required": {
                "text_count": ("INT", {"default": 1, "min": 1, "max": cls.MAX_INPUTS}),
                "text_1": ("STRING", txtArea_settings),
            },
            "optional": optional,
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("text",)
    FUNCTION = "run"
    CATEGORY = "text_utils_sp"

    def run(self, text_count=1, **kwargs):
        texts = []

        for i in range(1, text_count + 1):
            text = kwargs.get(f"text_{i}", "")
            if text != "":
                texts.append(text)

        result = ", ".join(filter(None, texts))
        result = result.rstrip(", ")
        self.combined_text = result
        print(f"MultiText preview: {self.combined_text}")
        return (result,)


class multiTextConcat:
    """テキスト入力数を動的に増減できる入力専用のテキスト結合ノード"""

    MAX_INPUTS = 20

    def __init__(self):
        self.combined_text = ""

    @classmethod
    def INPUT_TYPES(cls):
        # text_2〜text_20 をoptionalとして定義
        # forceInputを使ってコネクタ専用にする
        optional = {}
        for i in range(2, cls.MAX_INPUTS + 1):
            optional[f"text_{i}"] = ("STRING", {"forceInput": True})

        return {
            "required": {
                "text_count": ("INT", {"default": 1, "min": 1, "max": cls.MAX_INPUTS}),
                "text_1": ("STRING", {"forceInput": True}),
            },
            "optional": optional,
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("text",)
    FUNCTION = "run"
    CATEGORY = "text_utils_sp"

    def run(self, text_count=1, **kwargs):
        texts = []

        for i in range(1, text_count + 1):
            text = kwargs.get(f"text_{i}", "")
            if text != "":
                texts.append(text)

        result = ", ".join(filter(None, texts))
        result = result.rstrip(", ")
        self.combined_text = result
        print(f"MultiTextConcat preview: {self.combined_text}")
        return (result,)


NODE_CLASS_MAPPINGS = {
    "weight3xText": weight3xText,
    "weightMultiText": weightMultiText,
    "multiText": multiText,
    "multiTextConcat": multiTextConcat,
}
