// BUTTONS
const mainMenuButton = document.getElementById("mainMenuButton");

// IMAGE
const rewardImage = document.getElementById("rewardImage");
const rewardName = document.getElementById("rewardName");

// returns user to main menu
mainMenuButton.addEventListener('click', async () => {
    await chrome.action.setPopup({popup: 'popup.html'});
    window.location.assign('popup.html');
})

// calling it to test.
showReward("icons/icon16.png", "GREEN SQUARE");

function showReward(image, name) {
    rewardImage.src = image
    rewardName.textContent = name
}
