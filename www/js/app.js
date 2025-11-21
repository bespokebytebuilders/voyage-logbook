// Bucket List Builder - app/js/app.js

// State management
let bucketList = [];
let currentEditId = null;
let map = null;
let markers = {};
let tempMarker = null;
let currentFilter = 'all';
let currentSort = 'date';

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    initializeMap();
    loadItemsFromStorage();
    attachEventListeners();
    renderList();
    updateStats();
});

// Initialize Leaflet map
function initializeMap() {
    map = L.map('map').setView([20, 0], 2);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);
    
    // Map click handler for selecting location
    map.on('click', function(e) {
        if (document.getElementById('form-view').style.display !== 'none') {
            const { lat, lng } = e.latlng;
            setLocationFromMap(lat, lng);
        }
    });
}

// Set location from map click
function setLocationFromMap(lat, lng) {
    document.getElementById('coordinates-display').value = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    
    // Remove previous temp marker
    if (tempMarker) {
        map.removeLayer(tempMarker);
    }
    
    // Add temporary marker
    tempMarker = L.marker([lat, lng], {
        icon: L.icon({
            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
        })
    }).addTo(map);
    
    // Try to get location name (reverse geocoding would go here)
    // For now, just ensure the where field is not empty
    const whereInput = document.getElementById('where-input');
    if (!whereInput.value.trim()) {
        whereInput.value = `Location (${lat.toFixed(2)}, ${lng.toFixed(2)})`;
    }
}

// Load items from localStorage
function loadItemsFromStorage() {
    try {
        const stored = localStorage.getItem('bucketListItems');
        if (stored) {
            bucketList = JSON.parse(stored);
        }
    } catch (error) {
        console.error('Error loading from localStorage:', error);
        bucketList = [];
    }
}

// Save items to localStorage
function saveItemsToStorage() {
    try {
        localStorage.setItem('bucketListItems', JSON.stringify(bucketList));
    } catch (error) {
        console.error('Error saving to localStorage:', error);
        alert('Could not save data. Storage might be full.');
    }
}

// Attach event listeners
function attachEventListeners() {
    // Add item button
    document.getElementById('add-item-btn').addEventListener('click', showAddForm);
    
    // Form submit
    document.getElementById('item-form').addEventListener('submit', handleFormSubmit);
    
    // Cancel button
    document.getElementById('cancel-btn').addEventListener('click', showPreview);
    
    // Sort select
    document.getElementById('sort-select').addEventListener('change', function(e) {
        currentSort = e.target.value;
        renderList();
    });
    
    // Filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentFilter = this.dataset.filter;
            renderList();
        });
    });
    
    // Fit markers button
    document.getElementById('fit-markers-btn').addEventListener('click', fitAllMarkers);
    
    // Export button
    document.getElementById('export-btn').addEventListener('click', handleExport);
}

// Show add form
function showAddForm() {
    currentEditId = null;
    document.getElementById('form-title').textContent = 'Add New Item';
    document.getElementById('item-form').reset();
    document.getElementById('coordinates-display').value = '';
    document.getElementById('form-view').style.display = 'block';
    document.getElementById('preview-view').style.display = 'none';
    
    if (tempMarker) {
        map.removeLayer(tempMarker);
        tempMarker = null;
    }
}

// Show edit form
function showEditForm(id) {
    const item = bucketList.find(i => i.id === id);
    if (!item) return;
    
    currentEditId = id;
    document.getElementById('form-title').textContent = 'Edit Item';
    document.getElementById('what-input').value = item.what;
    document.getElementById('where-input').value = item.where;
    document.getElementById('coordinates-display').value = `${item.coordinates.lat}, ${item.coordinates.lng}`;
    document.getElementById('when-input').value = item.when || '';
    document.getElementById('why-input').value = item.why || '';
    document.getElementById('status-input').checked = item.status === 'completed';
    
    document.getElementById('form-view').style.display = 'block';
    document.getElementById('preview-view').style.display = 'none';
    
    // Show marker on map
    if (tempMarker) {
        map.removeLayer(tempMarker);
    }
    tempMarker = L.marker([item.coordinates.lat, item.coordinates.lng], {
        icon: L.icon({
            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
        })
    }).addTo(map);
    
    map.setView([item.coordinates.lat, item.coordinates.lng], 8);
}

// Show preview
function showPreview() {
    document.getElementById('form-view').style.display = 'none';
    document.getElementById('preview-view').style.display = 'block';
    
    if (tempMarker) {
        map.removeLayer(tempMarker);
        tempMarker = null;
    }
    
    currentEditId = null;
    document.getElementById('item-form').reset();
}

// Handle form submit
function handleFormSubmit(e) {
    e.preventDefault();
    
    const what = document.getElementById('what-input').value.trim();
    const where = document.getElementById('where-input').value.trim();
    const coordinates = document.getElementById('coordinates-display').value.trim();
    const when = document.getElementById('when-input').value;
    const why = document.getElementById('why-input').value.trim();
    const status = document.getElementById('status-input').checked ? 'completed' : 'planned';
    
    // Validation
    if (!what) {
        document.getElementById('what-error').textContent = 'Title is required';
        return;
    } else {
        document.getElementById('what-error').textContent = '';
    }
    
    if (!where || !coordinates) {
        document.getElementById('where-error').textContent = 'Location is required - click map to select';
        return;
    } else {
        document.getElementById('where-error').textContent = '';
    }
    
    // Parse coordinates
    const [lat, lng] = coordinates.split(',').map(c => parseFloat(c.trim()));
    
    const item = {
        id: currentEditId || Date.now(),
        what,
        where,
        coordinates: { lat, lng },
        when,
        why,
        status,
        createdAt: currentEditId ? bucketList.find(i => i.id === currentEditId).createdAt : Date.now(),
        completedAt: status === 'completed' ? Date.now() : null
    };
    
    if (currentEditId) {
        // Update existing item
        const index = bucketList.findIndex(i => i.id === currentEditId);
        bucketList[index] = item;
        updateMarker(item);
    } else {
        // Add new item
        bucketList.push(item);
        addMarker(item);
    }
    
    saveItemsToStorage();
    renderList();
    updateStats();
    showPreview();
}

// Delete item
function deleteItem(id) {
    if (confirm('Delete this bucket list item?')) {
        bucketList = bucketList.filter(i => i.id !== id);
        removeMarker(id);
        saveItemsToStorage();
        renderList();
        updateStats();
    }
}

// Toggle status
function toggleStatus(id) {
    const item = bucketList.find(i => i.id === id);
    if (item) {
        item.status = item.status === 'completed' ? 'planned' : 'completed';
        item.completedAt = item.status === 'completed' ? Date.now() : null;
        updateMarker(item);
        saveItemsToStorage();
        renderList();
        updateStats();
    }
}

// Add marker to map
function addMarker(item) {
    const iconUrl = item.status === 'completed' 
        ? 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png'
        : 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png';
    
    const marker = L.marker([item.coordinates.lat, item.coordinates.lng], {
        icon: L.icon({
            iconUrl: iconUrl,
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
        })
    }).addTo(map);
    
    marker.bindPopup(`
        <strong>${item.what}</strong><br>
        ${item.where}<br>
        ${item.when ? `Target: ${item.when}` : 'No target date'}
    `);
    
    markers[item.id] = marker;
}

// Update marker
function updateMarker(item) {
    removeMarker(item.id);
    addMarker(item);
}

// Remove marker
function removeMarker(id) {
    if (markers[id]) {
        map.removeLayer(markers[id]);
        delete markers[id];
    }
}

// Fit all markers
function fitAllMarkers() {
    if (Object.keys(markers).length === 0) return;
    
    const group = L.featureGroup(Object.values(markers));
    map.fitBounds(group.getBounds().pad(0.1));
}

// Render list
function renderList() {
    const listContainer = document.getElementById('items-list');
    const emptyState = document.getElementById('empty-state');
    
    // Filter items
    let filteredItems = bucketList;
    if (currentFilter !== 'all') {
        filteredItems = bucketList.filter(i => i.status === currentFilter);
    }
    
    // Sort items
    filteredItems.sort((a, b) => {
        if (currentSort === 'date') {
            if (!a.when) return 1;
            if (!b.when) return -1;
            return new Date(a.when) - new Date(b.when);
        } else if (currentSort === 'location') {
            return a.where.localeCompare(b.where);
        } else if (currentSort === 'status') {
            return a.status === 'completed' ? -1 : 1;
        }
        return 0;
    });
    
    if (filteredItems.length === 0) {
        listContainer.innerHTML = '';
        emptyState.style.display = 'block';
    } else {
        emptyState.style.display = 'none';
        listContainer.innerHTML = filteredItems.map(item => `
            <div class="item-card ${item.status}">
                <div class="item-header">
                    <div class="item-title">${item.what}</div>
                    <div class="item-actions">
                        <button class="icon-btn" onclick="showEditForm(${item.id})" title="Edit">✏️</button>
                        <button class="icon-btn" onclick="deleteItem(${item.id})" title="Delete">🗑️</button>
                    </div>
                </div>
                <div class="item-location">📍 ${item.where}</div>
                ${item.when ? `<div class="item-date">📅 ${item.when}</div>` : ''}
                <div>
                    <span class="status-badge ${item.status}">${item.status === 'completed' ? '✓ Completed' : 'Planned'}</span>
                </div>
            </div>
        `).join('');
    }
    
    // Update item count
    document.getElementById('item-count').textContent = bucketList.length;
}

// Update stats
function updateStats() {
    const total = bucketList.length;
    const completed = bucketList.filter(i => i.status === 'completed').length;
    const destinations = new Set(bucketList.map(i => i.where)).size;
    
    // Update progress
    document.getElementById('completed-count').textContent = completed;
    document.getElementById('total-count').textContent = total;
    const percentage = total > 0 ? (completed / total) * 100 : 0;
    document.getElementById('progress-fill').style.width = `${percentage}%`;
    
    // Update preview stats
    document.getElementById('preview-total').textContent = total;
    document.getElementById('preview-completed').textContent = completed;
    document.getElementById('preview-destinations').textContent = destinations;
}

// Handle export
function handleExport() {
    alert('Export functionality will be integrated with Lulu API for printing your custom logbook!');
}

// Initialize markers for loaded items
bucketList.forEach(item => addMarker(item));