import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getDatabase, ref, onValue, update, set } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";

const firebaseConfig = {
  apiKey: "AlzaSyAABvh6xwaH4J3RJLOCg_IFggfBLZDgICE",
  authDomain: "buss-c821b.firebaseapp.com",
  databaseURL: "https://buss-c821b-default-rtdb.firebaseio.com",
  projectId: "buss-c821b",
  storageBucket: "buss-c821b.firebasestorage.app",
  messagingSenderId: "420408813048",
  appId: "1:420408813048:web:d64ce1241ab24608dde20d"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

let selectedDate = "";
let selectedSeats = [];
let currentSeatsData = {};

let unsubFwd = null;

let ticketPrices = {
  oneWay: 1299,
  returnWay: 1299,
  twoWay: 2500
};

onValue(ref(db, 'ticketPrices'), (snapshot) => {
  const data = snapshot.val();
  if (data) {
    ticketPrices = {
      oneWay: parseFloat(data.oneWay) || 1299,
      returnWay: parseFloat(data.returnWay) || 1299,
      twoWay: parseFloat(data.twoWay) || 2500
    };
  }
  updateBookingUI();
});

function stopPreviousListeners() {
  if (unsubFwd) { unsubFwd(); unsubFwd = null; }
}

window.changeJourneyType = function() {
  const type = document.querySelector('input[name="journey_type"]:checked').value;
  const headerRoute = document.getElementById('header-route');
  const returnDateContainer = document.getElementById('return-date-container');
  selectedSeats = [];

  if(type === 'forward') {
    headerRoute.innerHTML = '<span class="text-amber-300 font-semibold text-sm"><i class="fa-solid fa-location-dot text-red-400 mr-1"></i> Haridwar</span> <i class="fa-solid fa-arrow-right-long text-amber-400"></i> <span class="text-amber-300 font-semibold text-sm"><i class="fa-solid fa-location-dot text-green-400 mr-1"></i> Katra</span>';
    returnDateContainer.classList.add('hidden');
  } else if (type === 'return') {
    headerRoute.innerHTML = '<span class="text-amber-300 font-semibold text-sm"><i class="fa-solid fa-location-dot text-green-400 mr-1"></i> Katra</span> <i class="fa-solid fa-arrow-right-long text-amber-400"></i> <span class="text-amber-300 font-semibold text-sm"><i class="fa-solid fa-location-dot text-red-400 mr-1"></i> Haridwar</span>';
    returnDateContainer.classList.add('hidden');
  } else if (type === 'twoway') {
    headerRoute.innerHTML = '<span class="text-amber-300 font-semibold text-sm"><i class="fa-solid fa-arrows-left-right text-amber-400 mr-1"></i> Haridwar <-> Katra (Round Trip)</span>';
    returnDateContainer.classList.remove('hidden');
  }

  if(selectedDate) {
    let d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    const retInput = document.getElementById('return-date-input');
    retInput.value = d.toISOString().split('T')[0];
    retInput.min = selectedDate;
  }
  updateBookingUI();
  fetchSeats();
};

function initDateStrip() {
  const dateStrip = document.getElementById('date-strip');
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const today = new Date();

  for (let i = 0; i < 60; i++) {
    const futureDate = new Date();
    futureDate.setDate(today.getDate() + i);
    const year = futureDate.getFullYear();
    const month = String(futureDate.getMonth() + 1).padStart(2, '0');
    const day = String(futureDate.getDate()).padStart(2, '0');
    const dateKey = `${year}-${month}-${day}`;
    const dayName = i === 0 ? "Today" : (i === 1 ? "Tomorrow" : days[futureDate.getDay()]);
    const monthName = months[futureDate.getMonth()];
    const dateNum = futureDate.getDate();

    const dateCard = document.createElement('button');
    dateCard.type = "button";
    dateCard.className = `date-card flex-shrink-0 w-20 py-2.5 px-2 rounded-xl text-center border transition-all ${i === 0 ? 'bg-amber-600 text-white border-amber-500 font-bold shadow-md scale-105' : 'bg-white text-slate-700 border-slate-200 hover:border-amber-400'}`;
    
    dateCard.onclick = () => {
      document.querySelectorAll('.date-card').forEach(btn => btn.className = 'date-card flex-shrink-0 w-20 py-2.5 px-2 rounded-xl text-center border transition-all bg-white text-slate-700 border-slate-200 hover:border-amber-400');
      dateCard.className = 'date-card flex-shrink-0 w-20 py-2.5 px-2 rounded-xl text-center border transition-all bg-amber-600 text-white border-amber-500 font-bold shadow-md scale-105';
      selectedDate = dateKey;
      document.getElementById('selected-date-label').innerText = `${dateNum} ${monthName} ${year}`;
      
      const retInput = document.getElementById('return-date-input');
      retInput.min = dateKey;
      if(!retInput.value || retInput.value < dateKey) {
        let nextDay = new Date(futureDate);
        nextDay.setDate(nextDay.getDate() + 1);
        retInput.value = nextDay.toISOString().split('T')[0];
      }

      selectedSeats = [];
      updateBookingUI();
      fetchSeats();
    };

    dateCard.innerHTML = `<div class="text-[10px] uppercase font-bold tracking-wider">${dayName}</div><div class="text-xl font-extrabold my-0.5">${dateNum}</div><div class="text-[11px] font-medium">${monthName}</div>`;
    dateStrip.appendChild(dateCard);

    if (i === 0) dateCard.click();
  }
}

window.fetchSeats = function() {
  if (!selectedDate) return;
  stopPreviousListeners();
  currentSeatsData = {};

  const type = document.querySelector('input[name="journey_type"]:checked').value;
  const retDate = document.getElementById('return-date-input').value;

  const bookingsRef = ref(db, 'bookings');
  
  unsubFwd = onValue(bookingsRef, (snapshot) => {
    currentSeatsData = {};
    const allBookings = snapshot.val() || {};
    
    Object.values(allBookings).forEach(booking => {
      if (booking.status === 'Cancelled') return;
      if (!booking.seats) return;
      
      const seatsArr = booking.seats.split(',').map(s => s.trim());
      
      if (type === 'forward' || type === 'twoway') {
        if ((booking.type === 'forward' || booking.type === 'twoway') && booking.date === selectedDate) {
          seatsArr.forEach(seat => currentSeatsData[seat] = { status: 'booked' });
        }
      }
      
      if (type === 'return' || type === 'twoway') {
        let targetDate = (type === 'twoway') ? retDate : selectedDate;
        let bookingRetDate = (booking.type === 'twoway') ? booking.returnDate : booking.date;
        
        if ((booking.type === 'return' || booking.type === 'twoway') && bookingRetDate === targetDate) {
          seatsArr.forEach(seat => currentSeatsData[seat] = { status: 'booked' });
        }
      }
    });
    
    renderSeatsStatus();
  });
};

const lowerDeckLayout = [
  ['L1', null, 'L12', 'L18'],
  ['L2', 'L7', 'L13', 'L19'],
  ['L3', 'L8', 'L14', 'L20'],
  ['L4', 'L9', 'L15', 'L21'],
  ['L5', 'L10', 'L16', 'L22'],
  ['L6', 'L11', 'L17', 'L23']
];

const upperDeckLayout = [
  ['U1', null, 'U12', 'U13'],
  ['U2', 'U7', 'U14', 'U15'],
  ['U3', 'U8', 'U16', 'U17'],
  ['U4', 'U9', 'U18', 'U19'],
  ['U5', 'U10', 'U20', 'U21'],
  ['U6', 'U11', 'U22', 'U23']
];

function createSeatHTML(seatCode) {
  const seat = document.createElement('div');
  seat.id = `seat-${seatCode}`;
  seat.className = 'sleeper-seat available';
  seat.onclick = () => handleSeatClick(seatCode);
  seat.innerHTML = `<div class="sleeper-pillow"></div><span>${seatCode}</span>`;
  return seat;
}

function createEmptySpace() {
  const empty = document.createElement('div');
  empty.style.width = '55px';
  empty.style.height = '95px';
  return empty;
}

function buildCustomDeck(layout, containerId) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';
  
  layout.forEach(rowArr => {
    const rowDiv = document.createElement('div');
    rowDiv.className = 'flex justify-between items-center gap-4';
    
    const leftGroup = document.createElement('div');
    leftGroup.className = 'flex gap-2';
    
    if (rowArr[0]) leftGroup.appendChild(createSeatHTML(rowArr[0]));
    else leftGroup.appendChild(createEmptySpace());
    
    if (rowArr[1]) leftGroup.appendChild(createSeatHTML(rowArr[1]));
    else leftGroup.appendChild(createEmptySpace());
    
    const aisle = document.createElement('div');
    aisle.className = 'w-8';
    
    const rightGroup = document.createElement('div');
    rightGroup.className = 'flex gap-2';
    
    if (rowArr[2]) rightGroup.appendChild(createSeatHTML(rowArr[2]));
    else rightGroup.appendChild(createEmptySpace());
    
    if (rowArr[3]) rightGroup.appendChild(createSeatHTML(rowArr[3]));
    else rightGroup.appendChild(createEmptySpace());
    
    rowDiv.appendChild(leftGroup);
    rowDiv.appendChild(aisle);
    rowDiv.appendChild(rightGroup);
    container.appendChild(rowDiv);
  });
}

window.switchDeck = function(deck) {
  document.getElementById('lower-deck-grid').classList.toggle('hidden', deck !== 'lower');
  document.getElementById('upper-deck-grid').classList.toggle('hidden', deck !== 'upper');
  document.getElementById('tab-lower').className = deck === 'lower' ? 'flex-1 py-2.5 rounded-xl font-semibold text-sm transition-all bg-amber-600 text-white shadow-md' : 'flex-1 py-2.5 rounded-xl font-semibold text-sm transition-all bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200';
  document.getElementById('tab-upper').className = deck === 'upper' ? 'flex-1 py-2.5 rounded-xl font-semibold text-sm transition-all bg-amber-600 text-white shadow-md' : 'flex-1 py-2.5 rounded-xl font-semibold text-sm transition-all bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200';
};

function renderSeatsStatus() {
  document.querySelectorAll('.sleeper-seat').forEach(seatElem => {
    const seatCode = seatElem.id.replace('seat-', '');
    const status = currentSeatsData[seatCode]?.status || 'available';

    if (selectedSeats.includes(seatCode)) {
      if (status === 'booked') {
        selectedSeats = selectedSeats.filter(s => s !== seatCode);
        updateBookingUI();
      } else {
        seatElem.className = 'sleeper-seat selected';
        return;
      }
    }
    seatElem.className = `sleeper-seat ${status}`;
  });
}

function handleSeatClick(seatCode) {
  if (currentSeatsData[seatCode]?.status === 'booked') return;
  const index = selectedSeats.indexOf(seatCode);
  if (index > -1) {
    selectedSeats.splice(index, 1);
  } else {
    if(selectedSeats.length >= 6) return alert("Maximum 6 seats allowed per booking.");
    selectedSeats.push(seatCode);
  }
  renderSeatsStatus();
  updateBookingUI();
}

function updateBookingUI() {
  const emptyMsg = document.getElementById('empty-selection-msg');
  const bookingForm = document.getElementById('booking-form');
  const container = document.getElementById('dynamic-passengers-container');
  const type = document.querySelector('input[name="journey_type"]:checked').value;

  let activePrice = ticketPrices.oneWay;
  let tripName = "One Way (Haridwar to Katra)";

  if (type === 'forward') {
    activePrice = ticketPrices.oneWay;
    tripName = "Haridwar to Katra";
  } else if (type === 'return') {
    activePrice = ticketPrices.returnWay;
    tripName = "Katra to Haridwar";
  } else if (type === 'twoway') {
    activePrice = ticketPrices.twoWay;
    tripName = "Round Trip (Two Way)";
  }

  document.getElementById('display-price-label').innerText = `${activePrice.toLocaleString('en-IN')} / Seat (${type === 'twoway' ? 'Two Way' : 'One Way'})`;
  document.getElementById('passenger-count').innerText = selectedSeats.length;

  if (selectedSeats.length === 0) {
    emptyMsg.classList.remove('hidden');
    bookingForm.classList.add('hidden');
    return;
  }

  emptyMsg.classList.add('hidden');
  bookingForm.classList.remove('hidden');

  const grandTotal = selectedSeats.length * activePrice;

  document.getElementById('summary-journey').innerText = tripName;
  document.getElementById('summary-seats').innerText = selectedSeats.join(', ');
  document.getElementById('summary-total').innerText = grandTotal.toLocaleString('en-IN');

  container.innerHTML = '';
  selectedSeats.forEach(seatCode => {
    container.innerHTML += `
    <div class="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
      <div class="text-xs font-bold text-amber-700 flex justify-between">
        <span><i class="fa-solid fa-bed mr-1"></i> Seat: ${seatCode}</span>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-2">
        <input type="text" id="p-name-${seatCode}" required placeholder="Passenger Name" class="bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-900 focus:border-amber-500 outline-none">
        <input type="number" id="p-age-${seatCode}" required min="1" max="100" placeholder="Age" class="bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-900 focus:border-amber-500 outline-none">
        <select id="p-gender-${seatCode}" required class="bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-900 focus:border-amber-500 outline-none">
          <option value="" disabled selected>Gender</option>
          <option value="Male">Male</option>
          <option value="Female">Female</option>
        </select>
      </div>
    </div>`;
  });
}

document.getElementById('booking-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const submitBtn = document.getElementById('submit-btn');

  const custName = document.getElementById('cust-name').value;
  const phone = document.getElementById('cust-phone').value;
  const type = document.querySelector('input[name="journey_type"]:checked').value;
  const retDate = document.getElementById('return-date-input').value;

  let activePrice = (type === 'twoway') ? ticketPrices.twoWay : (type === 'return' ? ticketPrices.returnWay : ticketPrices.oneWay);
  const totalAmount = selectedSeats.length * activePrice;

  const passengers = [];
  selectedSeats.forEach(seatCode => {
    let pData = {
      seat: seatCode,
      name: document.getElementById(`p-name-${seatCode}`).value,
      age: document.getElementById(`p-age-${seatCode}`).value,
      gender: document.getElementById(`p-gender-${seatCode}`).value
    };
    passengers.push(pData);
  });

  const bookingId = 'BK' + Date.now().toString().slice(-6);
  const tripDisplay = type === 'twoway' ? 'Round Trip (Two Way)' : (type === 'return' ? 'Return Only' : 'One Way');

  const options = {
    "key": "rzp_live_TqU6CUW4npqhVg",
    "amount": totalAmount * 100,
    "currency": "INR",
    "name": "Maa Vaishno Express",
    "description": `Bus Booking for Seats: ${selectedSeats.join(', ')}`,
    "handler": async function (response) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Saving Booking...`;

      const bookingData = {
        id: bookingId,
        bookingId: bookingId,
        type: type,
        tripType: tripDisplay,
        date: selectedDate,
        returnDate: (type === 'twoway') ? retDate : null,
        custName: custName,
        name: custName,
        phone: phone,
        seats: selectedSeats.join(', '),
        seatsCount: selectedSeats.length,
        passengers: passengers,
        totalAmount: totalAmount,
        totalPrice: totalAmount,
        paymentMode: "Online (Razorpay)",
        paymentId: response.razorpay_payment_id,
        status: "Confirmed",
        createdAt: new Date().toISOString()
      };

      try {
        await set(ref(db, `bookings/${bookingId}`), bookingData);

        document.getElementById('ticket-id').innerText = bookingId;
        document.getElementById('ticket-type').innerText = tripDisplay;
        document.getElementById('ticket-date').innerText = type === 'twoway' ? `${selectedDate} to ${retDate}` : selectedDate;
        document.getElementById('ticket-name').innerText = custName;
        document.getElementById('ticket-seats').innerText = selectedSeats.join(', ');
        document.getElementById('ticket-amount').innerText = `₹ ${totalAmount.toLocaleString('en-IN')}`;

        document.getElementById('ticket-modal').classList.remove('hidden');

        selectedSeats = [];
        document.getElementById('booking-form').reset();
        updateBookingUI();
      } catch (error) {
        console.error("Booking failed:", error);
        alert("Payment ho gaya lekin booking save karne mein error aayi. Support se sampark karein.");
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<i class="fa-solid fa-lock"></i> Pay & Book Now`;
      }
    },
    "prefill": {
      "name": custName,
      "contact": phone
    },
    "theme": {
      "color": "#d97706"
    }
  };

  const rzp = new Razorpay(options);
  rzp.open();
});

window.closeModal = () => document.getElementById('ticket-modal').classList.add('hidden');

buildCustomDeck(lowerDeckLayout, 'lower-deck-grid');
buildCustomDeck(upperDeckLayout, 'upper-deck-grid');
initDateStrip();
