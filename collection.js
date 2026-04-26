//BUTTONS
const mainMenuButton = document.getElementById("mainMenuButton");

// returns user to main menu
mainMenuButton.addEventListener('click', async () => {
    await chrome.action.setPopup({popup: 'popup.html'});
    window.location.assign('popup.html');
})