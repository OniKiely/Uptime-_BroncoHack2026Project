// BUTTONS
const mainMenuButton = document.getElementById("mainMenuButton");

// CONTAINER
const gridContainer = document.getElementById("grid-container");

// returns user to main menu
mainMenuButton.addEventListener('click', async () => {
    await chrome.action.setPopup({popup: 'popup.html'});
    window.location.assign('popup.html');
})

// use to add a new reward onto the collection
function addItem(headline, emoji, type) {
    const newItem = document.createElement('div');
    newItem.classList.add(`item`);

    const newHeadline = document.createElement('span');
    newItem.appendChild(newHeadline);
    newHeadline.classList.add(`headline`);
    newHeadline.textContent = headline;

    const newEmoji = document.createElement('span');
    newItem.appendChild(newEmoji);
    newEmoji.classList.add(`emoji`);
    newEmoji.textContent = emoji;

    const newType = document.createElement('span');
    newItem.appendChild(newType);
    newType.classList.add(`type`);
    newType.textContent = type;


    gridContainer.appendChild(newItem);
    console.log(newItem.textContent);
}