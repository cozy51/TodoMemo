function formatDatePickerKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDatePickerKey(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || "").trim());
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

function attachCustomDatePicker(input) {
  if (!input || input.dataset.customDatePickerAttached) return;
  input.dataset.customDatePickerAttached = "true";
  input.readOnly = true;
  input.setAttribute("aria-haspopup", "dialog");
  input.setAttribute("aria-expanded", "false");

  const wrapper = document.createElement("span");
  wrapper.className = "custom-date-field";
  input.replaceWith(wrapper);
  wrapper.append(input);

  const popup = document.createElement("div");
  popup.className = "custom-date-popup";
  popup.hidden = true;
  popup.setAttribute("role", "dialog");
  popup.setAttribute("aria-label", "日付を選択");

  const header = document.createElement("div");
  header.className = "custom-date-popup-header";
  const prevButton = document.createElement("button");
  prevButton.type = "button";
  prevButton.className = "custom-date-nav";
  prevButton.textContent = "‹";
  prevButton.setAttribute("aria-label", "前の月");
  const title = document.createElement("span");
  title.className = "custom-date-popup-title";
  const nextButton = document.createElement("button");
  nextButton.type = "button";
  nextButton.className = "custom-date-nav";
  nextButton.textContent = "›";
  nextButton.setAttribute("aria-label", "次の月");
  header.append(prevButton, title, nextButton);

  const weekdays = document.createElement("div");
  weekdays.className = "custom-date-weekdays";
  ["日", "月", "火", "水", "木", "金", "土"].forEach((weekday, index) => {
    const label = document.createElement("span");
    label.textContent = weekday;
    if (index === 0) label.className = "is-sunday";
    if (index === 6) label.className = "is-saturday";
    weekdays.append(label);
  });

  const days = document.createElement("div");
  days.className = "custom-date-days";

  const footer = document.createElement("div");
  footer.className = "custom-date-popup-footer";
  const todayButton = document.createElement("button");
  todayButton.type = "button";
  todayButton.className = "custom-date-today";
  todayButton.textContent = "今日";
  footer.append(todayButton);

  popup.append(header, weekdays, days, footer);
  const hostDialog = input.closest("dialog");
  (hostDialog || document.body).append(popup);

  let viewYear = new Date().getFullYear();
  let viewMonth = new Date().getMonth();

  function renderCalendar() {
    title.textContent = `${viewYear}年${viewMonth + 1}月`;
    const selected = parseDatePickerKey(input.value);
    const selectedKey = selected ? formatDatePickerKey(selected) : null;
    const todayKey = formatDatePickerKey(new Date());
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const leadingDays = new Date(viewYear, viewMonth, 1).getDay();
    const cellCount = Math.ceil((leadingDays + daysInMonth) / 7) * 7;

    const cells = [];
    for (let cellIndex = 0; cellIndex < cellCount; cellIndex += 1) {
      const dayNumber = cellIndex - leadingDays + 1;
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "custom-date-day";
      if (cellIndex % 7 === 0) cell.classList.add("is-sunday");
      if (cellIndex % 7 === 6) cell.classList.add("is-saturday");

      if (dayNumber < 1 || dayNumber > daysInMonth) {
        cell.disabled = true;
        cell.tabIndex = -1;
      } else {
        const dateKey = formatDatePickerKey(new Date(viewYear, viewMonth, dayNumber));
        cell.textContent = String(dayNumber);
        if (dateKey === todayKey) cell.classList.add("is-today");
        if (dateKey === selectedKey) cell.classList.add("is-selected");
        cell.addEventListener("click", () => selectDate(dateKey));
      }
      cells.push(cell);
    }
    days.replaceChildren(...cells);
  }

  function selectDate(dateKey) {
    input.value = dateKey;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    closePopup();
    input.focus();
  }

  function positionPopup() {
    const rect = input.getBoundingClientRect();
    const popupWidth = popup.offsetWidth || 264;
    const popupHeight = popup.offsetHeight || 300;
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = document.documentElement.clientHeight;

    let left = rect.left;
    if (left + popupWidth > viewportWidth - 8) {
      left = Math.max(8, viewportWidth - popupWidth - 8);
    }
    let top = rect.bottom + 6;
    if (top + popupHeight > viewportHeight - 8) {
      top = Math.max(8, rect.top - popupHeight - 6);
    }
    popup.style.left = `${left}px`;
    popup.style.top = `${top}px`;
  }

  function handleOutsideClick(event) {
    if (wrapper.contains(event.target) || popup.contains(event.target)) return;
    closePopup();
  }

  function handleKeydown(event) {
    if (event.key === "Escape") {
      event.stopPropagation();
      closePopup();
      input.focus();
    }
  }

  function handleReposition() {
    positionPopup();
  }

  function openPopup() {
    if (!popup.hidden) return;
    const selected = parseDatePickerKey(input.value) || new Date();
    viewYear = selected.getFullYear();
    viewMonth = selected.getMonth();
    renderCalendar();
    popup.hidden = false;
    input.setAttribute("aria-expanded", "true");
    positionPopup();
    document.addEventListener("mousedown", handleOutsideClick, true);
    document.addEventListener("keydown", handleKeydown, true);
    window.addEventListener("resize", handleReposition, true);
    window.addEventListener("scroll", handleReposition, true);
  }

  function closePopup() {
    if (popup.hidden) return;
    popup.hidden = true;
    input.setAttribute("aria-expanded", "false");
    document.removeEventListener("mousedown", handleOutsideClick, true);
    document.removeEventListener("keydown", handleKeydown, true);
    window.removeEventListener("resize", handleReposition, true);
    window.removeEventListener("scroll", handleReposition, true);
  }

  function togglePopup() {
    if (popup.hidden) openPopup(); else closePopup();
  }

  prevButton.addEventListener("click", () => {
    viewMonth -= 1;
    if (viewMonth < 0) {
      viewMonth = 11;
      viewYear -= 1;
    }
    renderCalendar();
    positionPopup();
  });
  nextButton.addEventListener("click", () => {
    viewMonth += 1;
    if (viewMonth > 11) {
      viewMonth = 0;
      viewYear += 1;
    }
    renderCalendar();
    positionPopup();
  });
  todayButton.addEventListener("click", () => selectDate(formatDatePickerKey(new Date())));

  input.addEventListener("click", togglePopup);
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      togglePopup();
    }
  });
}
