# Weight min, max and step values
WEIGHT_MIN = 0
WEIGHT_MAX = 1.95
WEIGHT_STEP = 0.05

# Weight display format (number or slider)
WEIGHT_DISPLAY = "number"

WEIGHT_LABEL_SUFFIX = " (weight)"

def apply_weight(text: str, weight: float) -> str:
    """
    与えられたテキストにウェイトを適用する。

    引数
        text (str): ウェイトを適用するテキスト。
        weight (float): テキストに適用される重み。

    戻り値
        str： (text:weight) "の形式で重みを適用したテキスト。

    weightが1に等しい場合、この関数はテキストをそのまま返すことに注意。
    """
    if weight == 1:
        return text
    else:
        return f"({text}:{round(weight,2)})"

# リストをフラット化して文字列のリストを返す
def convert_array(input_array):
    result = []
    for item in input_array:
        if isinstance(item, (list, tuple)):
            for element in item:
                if isinstance(element, str):
                    result.extend([s.strip() for s in element.split(",") if s.strip()])
                else:
                    result.append(element)
        elif isinstance(item, str):
            result.extend([s.strip() for s in item.split(",") if s.strip()])
        else:
            result.append(item)
    return result