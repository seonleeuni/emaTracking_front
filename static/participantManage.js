document.addEventListener("DOMContentLoaded", function () {
    const rowsPerPage = 12; // 한 페이지에 표시할 행 개수
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

    // 행 클릭 시 체크박스 체크/해제
    rows.forEach(row => {
        row.addEventListener("click", function(e) {
            // 체크박스 직접 클릭 시에는 이벤트 중복 방지
            if (e.target.tagName.toLowerCase() === 'input') return;

            const checkbox = this.querySelector(".rowCheckbox");
            checkbox.checked = !checkbox.checked;
        });
    });

    showPage(currentPage);
});

// 모두 선택 기능 추가
function selectAllRows() {
    const checkboxes = document.querySelectorAll("#dataTable .rowCheckbox");
    const selectAllBtn = document.getElementById("selectAllBtn");

    // 현재 모든 체크박스가 선택되었는지 확인
    const allChecked = Array.from(checkboxes).every(chk => chk.checked);

    // 모두 체크/해제
    checkboxes.forEach(chk => (chk.checked = !allChecked));

    // 버튼 텍스트 업데이트
    if (!allChecked) {
        selectAllBtn.innerText = `모두 선택 (${checkboxes.length})`;
    } else {
        selectAllBtn.innerText = "모두 선택";
    }
    updateCheckboxHeader();
}


// 선택한 행 삭제 기능
function deleteSelectedRows() {
    const table = document.getElementById("dataTable");
    const tbody = table.querySelector("tbody");
    const rows = Array.from(tbody.querySelectorAll("tr"));
    
    // 체크된 행과 피험자 ID 수집
    const checkedRows = rows.filter(row => 
        row.querySelector(".rowCheckbox").checked
    );

    if (checkedRows.length === 0) {
        alert("삭제할 피험자를 선택해주세요.");
        return;
    }

    const participantIds = checkedRows.map(row => 
        row.children[1].innerText.trim()
    );

    const confirmMsg = `피험자 ID ${participantIds.join(", ")}를 삭제하시겠습니까?`;
    
    if (confirm(confirmMsg)) {
        // 확인 시 선택된 행 삭제
        checkedRows.forEach(row => tbody.removeChild(row));

        alert("선택된 피험자가 삭제되었습니다.");
        
        // 삭제 후, 페이지 재계산 및 갱신 (페이징 재설정 필요시)
        //location.reload(); // 간단한 방법으로 페이지를 새로고침하여 페이징 재계산
    }
}

// 피험자 이름 순 정렬 기능
let isAscending = true;
function sortTableByName() {
    const table = document.getElementById("dataTable");
    const tbody = table.querySelector("tbody");
    const rows = Array.from(tbody.querySelectorAll("tr"));
    const button = document.getElementById("sortByNameBtn");

    rows.sort((a, b) => {
        const nameA = a.children[3].innerText.trim();
        const nameB = b.children[3].innerText.trim();

        return isAscending
            ? nameA.localeCompare(nameB)
            : nameB.localeCompare(nameA);
    });

    // tbody 재구성
    rows.forEach(row => tbody.appendChild(row));

    // 정렬 상태 토글
    isAscending = !isAscending;
    button.innerText = isAscending ? "▲ 이름순 정렬" : "▼ 이름순 정렬";

    // 정렬 후, 페이징을 다시 설정 (페이지 재계산)
    resetPagination(rows);
}

// 필터링 후 페이징을 다시 설정하는 함수
function resetPagination() {
    const rows = Array.from(document.querySelectorAll("#dataTable tbody tr")).filter(row => row.style.display !== "none");
    const rowsPerPage = 12;
    let currentPage = 1;
    const totalPages = Math.ceil(rows.length / rowsPerPage);

    const prevButton = document.getElementById("prevPage");
    const nextButton = document.getElementById("nextPage");
    const pageInfo = document.getElementById("pageInfo");

    function showPage(page) {
        rows.forEach((row, index) => {
            row.style.display =
                index >= (page - 1) * rowsPerPage && index < page * rowsPerPage ? "" : "none";
        });

        pageInfo.textContent = `페이지 ${page} / ${totalPages}`;

        prevButton.disabled = page === 1;
        nextButton.disabled = page === totalPages;
    }

    prevButton.onclick = () => {
        if (currentPage > 1) {
            currentPage--;
            showPage(currentPage);
        }
    };

    nextButton.onclick = () => {
        if (currentPage < totalPages) {
            currentPage++;
            showPage(currentPage);
        }
    };

    showPage(currentPage);
}

// 피험자 정보 수정 기능
let currentEditingRow = null;
document.getElementById("editSelectedBtn").addEventListener("click", function() {
    const checkedRows = Array.from(document.querySelectorAll("#dataTable tbody tr"))
        .filter(row => row.querySelector(".rowCheckbox").checked);

    if (checkedRows.length === 0) {
        alert("수정할 피험자를 선택해주세요.");
        return;
    }

    if (checkedRows.length > 1) {
        alert("한 번에 하나의 피험자만 수정 가능합니다.");
        return;
    }

    currentEditingRow = checkedRows[0];
    openEditPopup(currentEditingRow);
});
function openEditPopup(row) {
    const cells = row.children;

    document.getElementById("editParticipantId").innerText = cells[1].innerText;
    document.getElementById("editStudyName").value = cells[2].innerText;
    document.getElementById("editName").value = cells[3].innerText;
    document.getElementById("editPhone").value = cells[4].innerText;
    document.getElementById("editStartDate").value = cells[5].innerText;
    document.getElementById("editEndDate").value = cells[6].innerText;
    document.getElementById("editOS").value = cells[7].innerText;
    document.getElementById("editAge").value = cells[8].innerText;
    document.getElementById("editGender").value = cells[9].innerText;
    document.getElementById("editDOB").value = cells[10].innerText;

    document.getElementById("editPopup").style.display = "block";
    document.getElementById("popupOverlay").style.display = "block";
}
function closeEditPopup() {
    document.getElementById("editPopup").style.display = "none";
    document.getElementById("popupOverlay").style.display = "none";
}
function saveParticipantInfo() {
    const cells = currentEditingRow.children;

    cells[2].innerText = document.getElementById("editStudyName").value;
    cells[3].innerText = document.getElementById("editName").value;
    cells[4].innerText = document.getElementById("editPhone").value;
    cells[5].innerText = document.getElementById("editStartDate").value;
    cells[6].innerText = document.getElementById("editEndDate").value;
    cells[7].innerText = document.getElementById("editOS").value;
    cells[8].innerText = document.getElementById("editAge").value;
    cells[9].innerText = document.getElementById("editGender").value;
    cells[10].innerText = document.getElementById("editDOB").value;

    closeEditPopup();
    alert("피험자 정보가 수정되었습니다.");
}

// 피험자 데이터 엑셀로 추출
document.getElementById("exportBtn").addEventListener("click", exportCheckedRowsToExcel);

function exportCheckedRowsToExcel() {
    const rows = Array.from(document.querySelectorAll("#dataTable tbody tr"))
        .filter(row => row.querySelector(".rowCheckbox").checked);

    if (rows.length === 0) {
        alert("다운로드할 피험자를 선택해주세요.");
        return;
    }

    // 엑셀 데이터 구성
    const excelData = rows.map(row => ({
        "피험자ID": row.children[1].innerText,
        "연구명": row.children[2].innerText,
        "이름": row.children[3].innerText,
        "휴대폰번호": row.children[4].innerText,
        "수집시작일": row.children[5].innerText,
        "마지막수집일": row.children[6].innerText,
        "운영체제": row.children[7].innerText,
        "나이(만)": row.children[8].innerText,
        "성별": row.children[9].innerText,
        "생년월일": row.children[10].innerText,
    }));

    // 새 워크시트 생성
    const worksheet = XLSX.utils.json_to_sheet(excelData);

    // 새 워크북 생성 및 워크시트 추가
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "피험자데이터");

    // 파일 다운로드 (현재 날짜 포함)
    const date = new Date();
    const fileName = `피험자데이터_${date.getFullYear()}${date.getMonth()+1}${date.getDate()}.xlsx`;

    XLSX.writeFile(workbook, fileName);
}

// 체크된 피험자 수 / 전체 피험자 수
function updateCheckboxHeader() {
    const checkboxes = document.querySelectorAll("#dataTable .rowCheckbox");
    const checkedCount = Array.from(checkboxes).filter(chk => chk.checked).length;
    const totalCount = checkboxes.length;
    
    document.getElementById("checkboxHeader").innerText = `${checkedCount} / ${totalCount}`;
}

// 체크박스 상태가 변경될 때 이벤트 추가
document.querySelectorAll("#dataTable .rowCheckbox").forEach(checkbox => {
    checkbox.addEventListener("change", updateCheckboxHeader);
});

// 초기 로딩 시 체크 상태 업데이트
updateCheckboxHeader();

// 피험자 검색 기능
function filterParticipants() {
    const researchName = document.getElementById("researchSelectBox").value.trim();
    const name = document.getElementById("parName").value.trim();
    const dob = document.getElementById("parDob").value.trim();
    const phone = document.getElementById("parPhoneNumber").value.trim();

    const table = document.getElementById("dataTable");
    const tbody = table.querySelector("tbody");
    const rows = Array.from(tbody.getElementsByTagName("tr"));

    rows.forEach(row => {
        const cells = row.children;
        const rowResearchName = cells[2].innerText.trim();
        const rowName = cells[3].innerText.trim();
        const rowDOB = cells[10].innerText.trim();
        const rowPhone = cells[4].innerText.trim().slice(-4); // 전화번호 마지막 4자리

        // 검색어가 비어있거나 일치하는 경우만 표시
        const researchMatch = !researchName || rowResearchName.includes(researchName);
        const nameMatch = !name || rowName.includes(name);
        const dobMatch = !dob || rowDOB.includes(dob);
        const phoneMatch = !phone || rowPhone.includes(phone);

        if (researchMatch && nameMatch && dobMatch && phoneMatch) {
            row.style.display = ""; // 보이기
        } else {
            row.style.display = "none"; // 숨기기
        }
    });

    resetPagination(); // 필터링 후 페이징 다시 설정
}
// 초기화 버튼 기능 추가
document.getElementById("initBtn").addEventListener("click", function () {
    document.getElementById("researchSelectBox").value = "";
    document.getElementById("parName").value = "";
    document.getElementById("parDob").value = "";
    document.getElementById("parPhoneNumber").value = "";

    filterParticipants(); // 초기화 후 전체 목록 다시 표시
});