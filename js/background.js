// window id maps
const tabIdToLatexEditorWindowId = new Map();
const latexEditorWindowIdToTabId = new Map();
// for checking if editor is ready to communicate
const editorWindowIdToIsReadyPromise = new Map();

/**
 * Given an existing Chrome tab specified by tabId, we retrieve the associated latex editor window for that tab.
 * If none exists, we create a new Latex Editor Window with a call to createNewLatexEditorWindow() and associate
 * the new window to the given tab. Finally, we return said new latex editor window.
 *
 * @param {number} tabId
 * @returns {Promise<editorWindow>}
 */
async function getTheExistingAssociatedLatexEditorWindowOrCreateANewOne(tabId){
    // check if an existing LaTeX editor exists for the given input id
    let editorWindowId = tabIdToLatexEditorWindowId.get(tabId);
    let editorWindow = null;
    if (editorWindowId){ // an editorWindowId was stored, but it may have been closed
        try{ // chrome.windows.get() throws error if no window exists with id=editorWindowId
            editorWindow = await chrome.windows.get(editorWindowId);
            return editorWindow;
        } catch (e){ // the window must have been closed at some point
            editorWindowId = null;
        }
    }

    // Since one doesn't exist, create a new latex editor window for this tab
    const width = 500, height = 400;
    const displayWidth = (await chrome.system.display.getInfo())[0].bounds.width;
    // const displayWidth = chrome.system.display.width, displayHeight = chrome.system.display.height;
    editorWindow = await chrome.windows.create({
        url: "latexEditor.html",
        type: "popup",
        width: width,
        height: height,
        left: displayWidth - width,
        focused: true
    });

    // create a promise that only gets resolved when the latex editor window is ready for communication, then await it.
    let readyResolver; // function to be executed by message listener when this editor is ready to accept requests
    const readyPromise = new Promise((resolve)=>{readyResolver = resolve});
    editorWindowIdToIsReadyPromise.set(editorWindow.id, {readyPromise: readyPromise, readyResolver: readyResolver});
    await editorWindowIdToIsReadyPromise.get(editorWindow.id).readyPromise;

    // record the id of the new latex editor allocated to the specified tab id in id maps
    tabIdToLatexEditorWindowId.set(tabId, editorWindow.id); // for communication to editor from tab
    latexEditorWindowIdToTabId.set(editorWindow.id, tabId); // for communication to tab from editor
    return editorWindow;
}

/**
 * Do the following list of things when you receive the "open-latex-editor-window" command:
 * @returns {Promise<void>}
 */
async function handleOpenLatexEditorWindowCommand(){
    // get the tab in focus via a query
    const focusedTabQueryResponse = await chrome.tabs.query({active: true, currentWindow: true});
    if (!focusedTabQueryResponse || focusedTabQueryResponse.length !== 1){ // no tab in focus
        return;
    }
    const focusedTab = focusedTabQueryResponse[0];

    // run getUserTextSelectionInfo() on the tab in focus
    const executionResultArray = await chrome.scripting.executeScript({
        target: {tabId: focusedTab.id},
        function: getUserTextSelection,
    });
    const userTextSelection = executionResultArray[0].result ||
        {isTheUserEditingATextField: false, selectedText: ""};

    // get/create the editor window of this focused tab
    const editorWindow = await getTheExistingAssociatedLatexEditorWindowOrCreateANewOne(focusedTab.id);

    // focus on the editor window
    await chrome.windows.update(editorWindow.id, {focused:true});

    // run updateEditorGivenUserSelection() in the editor with userSelection as argument
    await chrome.runtime.sendMessage({
        msg: "updateEditorGivenUserSelection",
        target: editorWindow.id,
        data: userTextSelection
    });
}

/**
 * Retrieves the text that the user is highlighting and flag specifying whether they are currently editing a text input field.
 *
 * @returns {Object} An object containing:
 *   - `isTheUserEditingATextField` {boolean}: `true` if the user is focused on an editable text field (input, textarea, or content-editable), `false` otherwise.
 *   - `selectedText` {string}: The currently selected text on the page, or an empty string if no text is selected.
 */
function getUserTextSelection(){
    // Get selected text (or empty string if none)
    const selectedText = window.getSelection().toString();

    // Check if the active element is an input, textarea, or contenteditable
    const activeElement = document.activeElement;
    const isTheUserEditingATextField = activeElement && (
        activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.contentEditable === 'true' || activeElement.contentEditable === 'inherit'
    );
    return {
        isTheUserEditingATextField: isTheUserEditingATextField,
        selectedText: selectedText
    }
}

/**
 * Handle commands
 */
chrome.commands.onCommand.addListener(async (command)=>{
    // ignore irrelevant commands
    if (command !== "open-latex-editor-window") {
        return;
    }
    await handleOpenLatexEditorWindowCommand();
});

chrome.runtime.onMessage.addListener(async (message)=>{
    if(message.target !== "background"){
        return; // ignore messages not intended for this window
    }
    if(message.msg === "ready"){ // editor window signaled that it is now ready to take requests
        editorWindowIdToIsReadyPromise.get(message.data.id).readyResolver(`editor ${message.data.id} is ready`);
        return;
    }
    if(message.msg === "replaceSelection"){
        // TODO close editor when tab is closed
        const targetTabId = latexEditorWindowIdToTabId.get(message.data.id);
        await chrome.scripting.executeScript({
            target: {tabId: targetTabId},
            function: replaceSelection,
            args: [message.data.replacementString]
        });
        return;
    }
})

/**
 * Replace
 * @param replacementString
 */
function replaceSelection(replacementString){
    // in case we're editing a textarea
    const tagName = document.activeElement.tagName;
    if (tagName === "TEXTAREA" || tagName === "INPUT"){
        const textarea = document.activeElement;
        const start = textarea.selectionStart, end = textarea.selectionEnd;

        const originalText = textarea.value;
        textarea.value = originalText.substring(0, start) + replacementString + originalText.substring(end);
        textarea.setSelectionRange(start, start + replacementString.length);
    } else { // content editable div
        const selection = window.getSelection();
        const range = selection.getRangeAt(0);
        range.deleteContents();
        range.insertNode(document.createTextNode(replacementString));
    }
}
