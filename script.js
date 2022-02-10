'use strict';

const form = document.querySelector('.form');
const containerWorkouts = document.querySelector('.workouts');
const containerErrorMessage = document.querySelector(".error-message")
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');
const inputId = document.querySelector(".form__input--id");

const buttonSort = document.querySelector(".sort_btn");
const buttonReset = document.querySelector(".reset__btn");
const buttonShowAll = document.querySelector(".showall__btn");
const containerSortButtons = document.querySelector(".sort__buttons__container");

class Workout {

    id = (Date.now() + "").slice(-10);
    date = new Date();

    constructor(coords, distance, duration) {
        this.coords = coords;
        this.distance = distance;
        this.duration = duration;
    }

    _setDescription() {
        const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        this.description = `${this.type[0].toUpperCase()}${this.type.slice(1)} on ${months[this.date.getMonth()]} ${this.date.getDate()}`
    }
}

class Running extends Workout {
    type = "running";

    constructor(coords, distance, duration, cadence) {
        super(coords, distance, duration);
        this.cadence = cadence;
        this.calcPace();
        this._setDescription();
    }

    calcPace() {
        this.pace = this.duration / this.distance;
        return this.pace
    }
}

class Cycling extends Workout {
    type = "cycling";

    constructor(coords, distance, duration, elevation) {
        super(coords, distance, duration);
        this.elevation = elevation;
        this.calcSpeed();
        this._setDescription();
    }

    calcSpeed() {
        this.speed = this.distance / (this.duration / 60);
        return this.speed;
    }
}

class App {

    #addingNew;
    #map;
    #markers = [];
    #mapEvent;
    #dblEvent;
    #workouts = [];
    #zoom = 13;

    constructor() {
        this._getPosition();
        this._loadWorkouts();

        form.addEventListener("submit", this._saveWorkout.bind(this));
        inputType.addEventListener("change", this._toggleElevationField);
        containerWorkouts.addEventListener("click", this._handleListClicked.bind(this));
        containerWorkouts.addEventListener("dblclick", this._showEditForm.bind(this));
        document.addEventListener("keydown", this._keydownHandler.bind(this));

        containerSortButtons.addEventListener("click", this._sortList.bind(this));
        buttonReset.addEventListener("click", this._confirmReset.bind(this));
        buttonSort.addEventListener("click", this._toggleSortControls.bind(this));
        buttonShowAll.addEventListener("click", this._showALlMarkers.bind(this));
    }

    // ============================================================
    //  Public interface
    // ============================================================

    reset() {
        localStorage.removeItem("workouts");
        location.reload();
    }

    // ============================================================
    //  Event handlers
    // ============================================================
    _keydownHandler(e) {
        if (e.key === "Escape") {
            this._hideFormSmooth();
        }
    }

    _toggleElevationField() {
        inputElevation.closest(".form__row").classList.toggle("form__row--hidden");
        inputCadence.closest(".form__row").classList.toggle("form__row--hidden");
    }

    _saveWorkout(e) {
 
        e.preventDefault();

        const validInputs = (...inputs) => inputs.every(inp => Number.isFinite(inp));
        const arePositive = (...inputs) => inputs.every(inp => inp > 0);
        let workout;


        //  Get data from form
        const id = inputId.value;
        const type = inputType.value;
        const distance = Number(inputDistance.value);
        const duration = Number(inputDuration.value);

        this.#addingNew = (id === "0")
        let {lat, lng} = this.#addingNew ? this.#mapEvent.latlng : {};

        //  If running create running object
        if (type === "running") {
            const cadence = Number(inputCadence.value);

            //  Check data is valid
            if (!validInputs(distance, duration, cadence) || !arePositive(distance, duration, cadence)) {
                return this._displayError("Inputs have to be positive numbers");
            }

            if (this.#addingNew) workout = new Running([lat, lng], distance, duration, cadence);
            if (!this.#addingNew) {
                workout = this._findWorkout(inputId.value);
                workout.distance = +inputDistance.value;
                workout.duration = +inputDuration.value;
                workout.cadence = +inputCadence.value;
                workout.calcPace();
            }
         }

        //  If cycling create new cycling object
        if (type === "cycling") {
            const elevation = Number(inputElevation.value);

            //  Check data is valid
            if (!validInputs(distance, duration, elevation) || !arePositive(distance, duration)) {
                return this._displayError("Inputs have to be positive numbers");
            }

            if (this.#addingNew) workout = new Cycling([lat, lng], distance, duration, elevation);
            if (!this.#addingNew) {
                workout = this._findWorkout(inputId.value);
                workout.distance = +inputDistance.value;
                workout.duration = +inputDuration.value;
                workout.elevation = +inputElevation.value;
                workout.calcSpeed();
            }
        }
        
        //  Add object to workouts array
        if (this.#addingNew) this.#workouts.push(workout);

        //  Render on map
        this._renderWorkoutMarker(workout);

        //  Render on list
        this._renderWorkoutOnList(workout);

        //  Hide form and clear inputs
        this._hideForm();

        //  Save workouts
        this._saveWorkouts();
    }

    _handleListClicked(e) {
        if (e.target.classList.contains("workout__delete")) {
            this._deleteWorkout(e);
        } else {
            this._moveToPopup(e)
        }
    }

    _showForm(mapE) {
        this.#mapEvent = mapE;
        form.classList.remove("hidden");
        inputDistance.focus();
    }

    _showEditForm(e) {
        //  Get the workout
        const element = e.target.closest(".workout");
        if (!element) return;
        const workout = this._findWorkout(element.dataset.id);
        if (!workout) return;

        this.#dblEvent = e;

        // populate form
        if (inputType.value !== workout.type) {
            this._toggleElevationField()
        }

        inputType.value = workout.type;
        inputId.value = workout.id;
        inputDistance.value = workout.distance;
        inputDuration.value = workout.duration;

        if (workout.type === "running") inputCadence.value = workout.cadence;
        if (workout.type === "cycling") inputElevation.value = workout.elevation;
        
        //show form
        this._showForm(null);
    }

    _confirmReset() {
        if (confirm("All data will be lost, are you sure?")) {
            this.reset();
        }
    }

    _toggleSortControls() {
        containerSortButtons.classList.toggle("zero__height");
    }

    _sortList(e) {
        //  Get button
        const button = e.target.closest(".sort__button");
        if (!button) return;
        
        //  Sort array
        switch (button.dataset.type) {
            case "date":
                this.#workouts.sort((a, b) => a.date - b.date);
                break;
            case "distance":
                this.#workouts.sort((a, b) => a.distance - b.distance);
                break;
            case "duration":
                this.#workouts.sort((a, b) => a.duration - b.duration);
                break;
            case "pace":
                this.#workouts.sort((a, b) => a.pace - b.pace);
                break;
            case "cadence":
                this.#workouts.sort((a, b) => a.cadence - b.cadence);
                break;
            case "elevation":
                this.#workouts.sort((a, b) => a.elevation - b.elevation);
        }

        //  Clear list
        for (const child of containerWorkouts.children) {
            if (child.classList.contains("workout")) child.outerHTML = "";
        };

        //  Load list
        this.#addingNew = true;
        this.#workouts.forEach(workout => {
            this._renderWorkoutOnList(workout);
        });

        this.#addingNew = false;

    }

    _showALlMarkers(e) {
        var group = new L.featureGroup([...this.#markers]);
        this.#map.fitBounds(group.getBounds().pad(0.5));
    }

    // ============================================================
    //  Helper functions
    // ============================================================

    _hideForm() {
        inputDistance.value = inputCadence.value = inputDuration.value = inputElevation.value = "";
        inputId.value = "0";

        form.style.display = "none";
        form.classList.add("hidden");
        setTimeout(() => form.style.display = "grid", 1000);
    }

    _hideFormSmooth() {
        inputDistance.value = inputCadence.value = inputDuration.value = inputElevation.value = "";
        inputId.value = "0";
        form.classList.add("hidden");
    }
 
    _moveToPopup(e) {
        const element = e.target.closest(".workout");
        if (!element) return;
        const workout = this._findWorkout(element.dataset.id);
        this.#map.setView(workout.coords, this.#map.getZoom());
    }

    _deleteWorkout(e) {

        //  Confirm
        if (!confirm("Are you sure?")) return;

        //  Get workout
        const element = e.target.closest(".workout");
        if (!element) return;

        //  Get position in array
        const workout = this._findWorkout(element.dataset.id);
        const position = this.#workouts.indexOf(workout);
        const marker = this.#markers.find(m => m._id === workout.id);
        
        //  Delete from array
        this.#workouts.splice(position, 1);
        this.#markers.splice(marker, 1);
        
        //  Delete from list
        element.outerHTML = "";
        
        //  Delete from map
        this._deleteMarker(workout.id);

        //  Save workouts
        this._saveWorkouts();
    }

    _deleteMarker(id) {
        const newMarkers = [];
        this.#markers.forEach(function(marker) {
            if (marker._id === id) {
                this.#map.removeLayer(marker);
            } else {
                newMarkers.push(marker);
            }
        }.bind(this));

        this.#markers = newMarkers;
    }

    _findWorkout(id) {
        if (!id) return;
        return this.#workouts.find(work => work.id === id, {animate: true, pan: {duration: 1}});
    }

    _displayError(message) {
        containerErrorMessage.textContent = message;
        containerErrorMessage.style.display = "block";
        containerErrorMessage.style.opacity = 0.95
        setTimeout(() => {
            containerErrorMessage.style.opacity = 0;
            containerErrorMessage.style.display = "none";
        }, 5000)
    }

    _getPosition() {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(this._loadMap.bind(this), this._handleMapError)
        }        
    }

    _loadMap(position) {
        const {latitude} = position.coords;
        const {longitude} = position.coords;
        const coords = [latitude, longitude];
    
        this.#map = L.map('map').setView(coords, this.#zoom);
    
        this.#map.on('click', this._showForm.bind(this));
    
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(this.#map);

        this.#workouts.forEach(workout => {
            this._renderWorkoutMarker(workout);
        });

    }

    _renderWorkoutOnList(workout) {
        let html = `
        <li class="workout workout--${workout.type}" data-id="${workout.id}">
            <h2 class="workout__title">${workout.description}</h2>
            <div class="workout__controls"><button class="workout__delete">❌</button></div>
            <div class="workout__details">
            <span class="workout__icon">${(workout.type === "running") ? "🏃‍♂️" : "🚴‍♀️"}</span>
            <span class="workout__value">${workout.distance}</span>
            <span class="workout__unit">km</span>
            </div>
            <div class="workout__details">
            <span class="workout__icon">⏱</span>
            <span class="workout__value">${workout.duration}</span>
            <span class="workout__unit">min</span>
            </div>
        `;

        if (workout.type == "running") {
            html += `
                <div class="workout__details">
                    <span class="workout__icon">⚡️</span>
                    <span class="workout__value">${workout.pace.toFixed(1)}</span>
                    <span class="workout__unit">min/km</span>
                </div>
                <div class="workout__details">
                    <span class="workout__icon">🦶🏼</span>
                    <span class="workout__value">${workout.cadence.toFixed(1)}</span>
                    <span class="workout__unit">spm</span>
                </div>
            </li>
            `;
        }

        if (workout.type == "cycling") {
            html += `
                <div class="workout__details">
                    <span class="workout__icon">⚡️</span>
                    <span class="workout__value">${workout.speed.toFixed(1)}</span>
                    <span class="workout__unit">km/h</span>
                </div>
                <div class="workout__details">
                    <span class="workout__icon">⛰</span>
                    <span class="workout__value">${workout.elevation}</span>
                    <span class="workout__unit">m</span>
                </div>
            </li>
            `;
        }

        if (this.#addingNew) form.insertAdjacentHTML("afterend", html);
        if (!this.#addingNew) {
            if (!this.#dblEvent) return;
            const element = this.#dblEvent.target.closest(".workout");
            element.outerHTML = html;
        }
    }

    _renderWorkoutMarker(workout) {
        let marker = L.marker(workout.coords)
                    .addTo(this.#map)
                    .bindPopup(L.popup({
                        maxWidth: 250,
                        minWidth: 100,
                        autoClose: false,
                        closeOnClick: false,
                        className: `${workout.type}-popup`
                    }))
                    .setPopupContent(`${(workout.type === "running") ? "🏃‍♂️" : "🚴‍♀️"} ${workout.description}`)
                    .openPopup();
        
        marker._id = workout.id;
        this.#markers.push(marker);
    }

    _handleMapError(error){
        //Handle Errors
       switch(error.code) {
          case error.PERMISSION_DENIED:
              this._displayError("User denied the request for Geolocation.");
              break;
          case error.POSITION_UNAVAILABLE:
              this._displayError("Location information is unavailable.");
              break;
          case error.TIMEOUT:
             this._displayError("The request to get user location timed out.");
              break;
          case error.UNKNOWN_ERROR:
             this._displayError("An unknown error occurred.");
              break;
       }
    }

    _saveWorkouts() {
        localStorage.setItem("workouts", JSON.stringify(this.#workouts));
    }

    _loadWorkouts() {
        const data = JSON.parse(localStorage.getItem("workouts"));
        if (!data) return;

        data.forEach(datum => {
            let object;

            if (datum.type === "running") {
                object = new Running(datum.coords, datum.distance, datum.duration, datum.cadence);
            }

            if (datum.type === "cycling") {
                object = new Cycling(datum.coords, datum.distance, datum.duration, datum.elevation);
            }

            object.type = datum.type;
            object.id = datum.id;
            object.date = datum.date;

            this.#workouts.push(object);
        });

        this.#addingNew = true;
        this.#workouts.forEach(workout => {
            this._renderWorkoutOnList(workout);
        });

        this.#addingNew = false;
    }
}

const app = new App();
