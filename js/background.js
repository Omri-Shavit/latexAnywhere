chrome.commands.onCommand.addListener((command) => {
    if (command === "open-popup-window") {
        // get user's selected text
        chrome.windows.create({
            url: "popup.html",
            type: "popup",
            width: 500,
            height: 400
        });
    }
});
