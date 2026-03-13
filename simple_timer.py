import time

# グローバル変数で開始時間を共有（無線接続用）
# 他のノードとの競合を避けるためにユニークな名前に変更
_SP8999_SIMPLE_TIMER_START_TIME = 0.0

# --- 計測開始ノード ---
class SimpleTimerStart:
    def __init__(self):
        pass

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {},
            "optional": {
                "signal": ("*",),
            }
        }

    RETURN_TYPES = ("*",)
    RETURN_NAMES = ("signal",)
    FUNCTION = "start_timer"
    CATEGORY = "text_utils_sp"

    @classmethod
    def IS_CHANGED(s, **kwargs):
        return float("nan")

    def start_timer(self, signal=None):
        global _SP8999_SIMPLE_TIMER_START_TIME
        _SP8999_SIMPLE_TIMER_START_TIME = time.time()
        # シグナルはそのままスルーさせる（順序制御用）
        return (signal,)

# --- 計測終了＆時間出力ノード ---
class SimpleTimerEnd:
    def __init__(self):
        self.last_start_time = 0.0
        self.last_end_time = 0.0

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "image": ("IMAGE",),      # 画像処理が終わったことを保証するために画像を通す
            },
        }

    RETURN_TYPES = ("IMAGE", "STRING", "STRING")
    RETURN_NAMES = ("image", "single_time_str", "total_time_str")
    FUNCTION = "end_timer"
    CATEGORY = "text_utils_sp"
    OUTPUT_NODE = True

    @classmethod
    def IS_CHANGED(s, **kwargs):
        return float("nan")

    def end_timer(self, image):
        global _SP8999_SIMPLE_TIMER_START_TIME
        start_time = _SP8999_SIMPLE_TIMER_START_TIME
        now = time.time()
        
        # スタートからの総時間 (バッチなどの総合出力時間)
        total_elapsed = now - start_time
        
        # スタート時間が変わった（＝新しいバッチや実行）場合はリセット扱い
        if start_time != self.last_start_time:
            lap_elapsed = total_elapsed
            self.last_start_time = start_time
        else:
            # 連続実行（バッチなど）の場合は前回終了時からの差分
            lap_elapsed = now - self.last_end_time

        self.last_end_time = now

        # 画像のバッチサイズを取得 (ComfyUIの画像は [B, H, W, C] などのテンソル)
        batch_size = 1
        try:
            if hasattr(image, "shape") and len(image.shape) > 0:
                # ComfyUIのバッチサイズは通常shape[0]に入っている
                batch_size = max(1, int(image.shape[0]))
        except Exception:
            pass

        # 1枚あたりの生成時間
        single_elapsed = lap_elapsed / batch_size
        
        # 時間をフォーマット
        single_time_str = f"{single_elapsed:.2f} seconds"
        total_time_str = f"{total_elapsed:.2f} seconds"
        
        # コンソールにも表示
        print(f"Timer - Single(Batch:{batch_size}): {single_time_str} | Total: {total_time_str}")

        return {
            "ui": {"text": [single_time_str]},
            "result": (image, single_time_str, total_time_str)
        }

# --- ノードのマッピング ---
NODE_CLASS_MAPPINGS = {
    "SimpleTimerStart": SimpleTimerStart,
    "SimpleTimerEnd": SimpleTimerEnd
}
