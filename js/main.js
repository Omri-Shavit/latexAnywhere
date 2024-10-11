async function main() {
    const uuid = (await chrome.windows.getCurrent()).id;
    window.uuid = uuid; // for debugging

    // get HTML components
    const editorTextArea = document.getElementById("editorTextArea")
    const mathFieldSpan = document.getElementById('mathFieldSpan');
    const replaceBtn = document.getElementById("replaceBtn");

    // button
    function replaceSelection(){
        const code = editor.getValue();
        chrome.runtime.sendMessage({
            msg:"replaceSelection",
            target:"background",
            data:{
                id: uuid,
                replacementString: code
            }
        })
    }
    replaceBtn.addEventListener('click', replaceSelection);
    document.addEventListener("keydown", (e)=>{
        if (e.key==="Enter" && e.ctrlKey){
            replaceSelection();
        }
    })

    // CodeMirror
    const editor = CodeMirror.fromTextArea(editorTextArea, {
        mode: "stex",    // LaTeX mode for CodeMirror
        // theme: "neat", // Optional: Use a theme
        lineNumbers: true, // Show line numbers
        lineWrapping: true // latex wrap lines
    });

    // MathQuill
    const MQ = MathQuill.getInterface(2); // keeps the API stable
    const mathField = MQ.MathField(mathFieldSpan, {
        leftRightIntoCmdGoes: 'up',
        autoCommands: 'pi theta sqrt sum',
        handlers: {
            edit: () => {
                editor.setValue(mathField.latex());
            },
        },
    });

    function updateEditorGivenUserSelection(userTextSelection) {
        // handle replace button
        replaceBtn.disabled = !userTextSelection.isTheUserEditingATextField;
        if (replaceBtn.disabled) {
            replaceBtn.innerText = "No editable text is selected";
        } else if (userTextSelection.selectedText === "") {
            replaceBtn.innerText = "Insert this code";
        } else {
            replaceBtn.innerText = "Replace selection with this code"
        }
        editor.setValue(userTextSelection.selectedText);
        mathField.latex(userTextSelection.selectedText);
        const textarea = document.getElementsByTagName("textarea")[0];
        textarea.focus();
    }
    chrome.runtime.sendMessage({
        msg: "ready",
        target: "background",
        data:{
            id: uuid
        }
    });

    chrome.runtime.onMessage.addListener((message)=>{
        if(message.target !== uuid){
            return; // ignore messages not intended for this window
        }
        console.log(`message received:\n${message}`);
        if (message.msg === "updateEditorGivenUserSelection"){
            updateEditorGivenUserSelection(message.data);
        }
    })
}

document.addEventListener("DOMContentLoaded", main);
