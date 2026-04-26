
// LABELS
const currentTime = document.getElementById("currentTime");
const timeLeft = document.getElementById("timeLeft");

// BUTTONS
const startBreakButton = document.getElementById("startBreakButton");
const add15MinsButton = document.getElementById("add15MinsButton");
const collectionButton = document.getElementById("collectionButton");

// PROGRESS BAR
const fill = document.getElementById("progressFill");


// call this when you want to change the progress bar percentage
function setProgress(percent) {
  fill.style.width = percent + '%';
}

// opens the collection page
collectionButton.addEventListener('click', async () => {
    await chrome.action.setPopup({popup: 'collection.html'});
    window.location.assign('collection.html');
})

// going to reward page on start break press is temporrary for testing
startBreakButton.addEventListener('click', async () => {
    await chrome.action.setPopup({popup: 'reward.html'});
    window.location.assign('reward.html');
});


