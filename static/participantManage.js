document.addEventListener("DOMContentLoaded", function () {
    const rowsPerPage = 10; // 한 페이지에 표시할 행 개수
    let currentPage = 1;

    const table = document.getElementById("dataTable");
    if (!table) return; // 테이블이 없으면 코드 실행 안 함

    const tbody = table.querySelector("tbody");
    const rows = Array.from(tbody.getElementsByTagName("tr"));
    const totalPages = Math.ceil(rows.length / rowsPerPage);

    const prevButton = document.getElementById("prevPage");
    const nextButton = document.getElementById("nextPage");
    const pageInfo = document.getElementById("pageInfo");

    if (!prevButton || !nextButton || !pageInfo) return; // 버튼 또는 페이지 정보가 없으면 실행 안 함

    function showPage(page) {
        // ✅ 기존 tbody를 유지한 채로, 각 행의 `display` 속성만 조절
        rows.forEach((row, index) => {
            row.style.display =
                index >= (page - 1) * rowsPerPage && index < page * rowsPerPage ? "" : "none";
        });

        pageInfo.textContent = `페이지 ${page} / ${totalPages}`;

        prevButton.disabled = page === 1;
        nextButton.disabled = page === totalPages;
    }

    prevButton.addEventListener("click", () => {
        if (currentPage > 1) {
            currentPage--;
            showPage(currentPage);
        }
    });

    nextButton.addEventListener("click", () => {
        if (currentPage < totalPages) {
            currentPage++;
            showPage(currentPage);
        }
    });

    showPage(currentPage);
});