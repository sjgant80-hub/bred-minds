// page/boot.js — if the page's module has not started in 4 seconds, say why and offer a reload.
setTimeout(function () { if (!window.__bm) document.getElementById('boot').style.display = 'block'; }, 4000);
document.getElementById('reload').addEventListener('click', function () { location.reload(); });
