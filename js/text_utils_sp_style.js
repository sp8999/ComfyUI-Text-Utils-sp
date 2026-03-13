/* style only */
export function injectSP8999Styles() {
    if (document.getElementById("sp8999-common-styles")) return;

    const style = document.createElement("style");
    style.id = "sp8999-common-styles";
    style.innerHTML = `
        /* --- SelectTexts Styles --- */
        .sp8999-select-texts-container {
            display: flex;
            flex-direction: column;
            gap: 8px;
            padding: 0px 10px 4px 10px;
            margin-top: -20px;
            box-sizing: border-box;
            width: 100%;
            background-color: transparent;
        }
        .sp8999-select-texts-group {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
        }
        .sp8999-select-texts-btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 4px 10px;
            border-radius: 5px;
            font-size: 12px;
            cursor: pointer;
            user-select: none;
            transition: all 0.1s ease;
            border: 1px solid #555;
            background-color: #3a3a3a;
            color: #777;
            max-width: 100%;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            box-sizing: border-box;
        }
        .sp8999-select-texts-btn.is-active {
            border: 2px solid #3a9e4a;
            background-color: #1a5c2a;
            color: #c8ffc8;
            padding: 3px 9px;
        }

        /* --- SelectLists Styles --- */
        .sp8999-excl-list-container {
            display: flex;
            flex-direction: column;
            width: 100%;
        }
        .sp8999-excl-row {
            display: flex;
            align-items: flex-start;
            gap: 10px;
            margin-bottom: 8px;
            width: 100%;
            background: var(--comfy-input-bg, #222);
            padding: 6px 8px;
            border-radius: 4px;
            box-sizing: border-box;
        }
        .sp8999-excl-toggle {
            flex-shrink: 0;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 38px;
            min-width: 38px;
            height: 20px;
            min-height: 20px;
            max-height: 20px;
            border-radius: 10px;
            cursor: pointer;
            background: #555;
            position: relative;
            transition: background 0.2s;
            margin-top: 2px;
            align-self: flex-start;
        }
        .sp8999-excl-toggle.is-on {
            background: #3a9e4a;
        }
        .sp8999-excl-toggle::after {
            content: '';
            position: absolute;
            top: 2px;
            left: 2px;
            width: 16px;
            height: 16px;
            border-radius: 50%;
            background: #fff;
            transition: transform 0.2s;
        }
        .sp8999-excl-toggle.is-on::after {
            transform: translateX(18px);
        }
        textarea.sp8999-excl-preview {
            flex-grow: 1;
            font-size: 11px;
            color: var(--input-text, #ddd);
            background: var(--comfy-bg-color, #1a1a1a);
            border: 1px solid var(--border-color, #444);
            border-radius: 4px;
            padding: 4px 6px;
            resize: vertical;
            min-height: 24px;
            max-height: 100px;
            word-break: break-all;
            white-space: pre-wrap;
            outline: none;
        }
        .sp8999-excl-label {
            flex-grow: 1;
            font-size: 11px;
            color: var(--input-text, #ddd);
            word-break: break-word;
            white-space: pre-wrap;
        }
        .sp8999-preview-wrapper {
            margin-top: 4px;
            padding-top: 4px;
            border-top: 1px solid var(--border-color, #444);
        }
        .sp8999-preview-label {
            font-size: 10px;
            color: #888;
            margin-bottom: 2px;
        }
        .sp8999-preview-text {
            font-size: 11px;
            color: var(--input-text, #ccc);
            word-break: break-word;
        }

        /* --- WeightMultiText Counter Styles --- */
        .sp8999-counter-dom-wrapper {
            display: flex;
            justify-content: center;
            width: 100%;
            padding: 4px 0;
        }
        .sp8999-counter-container {
            display: flex;
            align-items: center;
            justify-content: center;
            background-color: #2a2a2a;
            border: 1px solid #555;
            border-radius: 6px;
            width: 120px;
            height: 24px;
            margin: 0;
            user-select: none;
            overflow: hidden;
        }
        .sp8999-counter-btn {
            display: flex;
            align-items: center;
            justify-content: center;
            background-color: #3a3a3a;
            width: 34px;
            height: 100%;
            cursor: pointer;
            font-weight: bold;
            font-size: 16px;
            color: #ddd;
            transition: background-color 0.1s;
        }
        .sp8999-counter-btn:hover {
            background-color: #4a4a4a;
        }
        .sp8999-counter-btn.disabled {
            color: #666;
            cursor: default;
        }
        .sp8999-counter-btn.disabled:hover {
            background-color: #3a3a3a;
        }
        .sp8999-counter-val {
            flex: 1;
            text-align: center;
            font-family: sans-serif;
            font-size: 13px;
            color: #ccc;
            cursor: pointer;
        }
    `;
    document.head.appendChild(style);
}
