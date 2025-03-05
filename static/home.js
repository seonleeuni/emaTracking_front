document.addEventListener("DOMContentLoaded", function () {
    let dropdowns = document.querySelectorAll(".has-dropdown .title");

    dropdowns.forEach(function (title) {
        title.addEventListener("click", function () {
            let parent = this.parentElement;
            parent.classList.toggle("active"); // 'active' 클래스 추가/제거
            
            let toggleBtn = this.querySelector(".toggle-btn");
            if (toggleBtn) {
                toggleBtn.innerText = parent.classList.contains("active") ? "-" : "+";
            }
        });
    });
});