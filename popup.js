// HTML components
const editorTextArea = document.getElementById("editorTextArea")
const mathFieldSpan = document.getElementById('mathFieldSpan');
const replaceBtn = document.getElementById("replaceBtn");

// button
replaceBtn.addEventListener('click', () => { // TODO
    const inputValue = document.getElementById('text-input').value;

    // chrome.storage.local.set({ userInput: inputValue }, () => {
    //     console.log('User input saved: ' + inputValue);
    //     window.close(); // Close the popup after submission
    // });
    //});
});

// CodeMirror
const editor = CodeMirror.fromTextArea(editorTextArea, {
    mode: "stex",    // LaTeX mode for CodeMirror
    // theme: "neat", // Optional: Use a theme
    lineNumbers: true // Show line numbers
});

// mathquill
const MQ = MathQuill.getInterface(2); // keeps the API stable

const mathField = MQ.MathField(mathFieldSpan, {
    leftRightIntoCmdGoes: 'up',
    autoCommands: 'pi theta sqrt sum',
    handlers: {
        edit: function () {
            editor.setValue(mathField.latex());
        },
    },
});
