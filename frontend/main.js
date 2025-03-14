// Global variables
let servers = {};
let selectedServer = null;
let lastPingResults = {};
let isRefreshing = false;
let lastRefreshTime = 0;

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    initApp();
    initWindowSize();
    setupCustomServerCheck();
});

// Initialize window size
async function initWindowSize() {
    try {
        const { invoke } = window.__TAURI__.tauri;
        
        // Set initial window size
        await invoke('set_window_size', {
            width: 1000,
            height: 800,
            resizable: true
        });
        
        // Center the window
        await invoke('center_window');
    } catch (error) {
        console.error('Error setting window size:', error);
    }
}

// Initialize the application
async function initApp() {
    try {
        // Create refresh button
        createRefreshButton();
        
        // Initialize with fallback servers first
        servers = getFallbackServers();
        renderServerList(servers);
        
        // Then try to get the server list from the backend
        const backendServers = await getServers();
        if (backendServers && Object.keys(backendServers).length > 0) {
            servers = processServerData(backendServers);
            renderServerList(servers);
        }
        
        // Add event listeners
        document.getElementById('generate-report-btn').addEventListener('click', generateConnectivityReport);
        document.getElementById('check-all-servers-btn').addEventListener('click', checkAllServers);
        
        // Set up periodic server list refresh (every 30 minutes)
        setInterval(refreshServerList, 30 * 60 * 1000);
    } catch (error) {
        console.error('Error initializing app:', error);
        // Ensure we at least show fallback servers
        if (Object.keys(servers).length === 0) {
            servers = getFallbackServers();
            renderServerList(servers);
        }
    }
}

// Create refresh button
function createRefreshButton() {
    const headerElement = document.querySelector('header');
    if (!headerElement) return;
    
    // Create refresh button container
    const refreshContainer = document.createElement('div');
    refreshContainer.className = 'refresh-container';
    
    // Create refresh button
    const refreshButton = document.createElement('button');
    refreshButton.id = 'refresh-servers-btn';
    refreshButton.className = 'refresh-button';
    refreshButton.innerHTML = '<span class="refresh-icon">↻</span> Refresh Servers';
    refreshButton.title = 'Refresh server list with latest IPs from Steam';
    
    // Add click event
    refreshButton.addEventListener('click', async () => {
        // Prevent rapid clicking
        if (isRefreshing) return;
        
        // Check if last refresh was less than 30 seconds ago
        const now = Date.now();
        if (now - lastRefreshTime < 30000) {
            const remainingTime = Math.ceil((30000 - (now - lastRefreshTime)) / 1000);
            showMessage(`Please wait ${remainingTime} seconds before refreshing again`);
            return;
        }
        
        // Show loading state
        refreshButton.classList.add('refreshing');
        refreshButton.innerHTML = '<span class="refresh-icon spinning">↻</span> Refreshing...';
        
        // Refresh server list
        const hasChanges = await refreshServerList(true);
        
        // Update button state
        refreshButton.classList.remove('refreshing');
        refreshButton.innerHTML = '<span class="refresh-icon">↻</span> Refresh Servers';
        
        // Show message
        if (hasChanges) {
            showMessage('Server list updated with latest IPs from Steam');
        } else {
            showMessage('Server list is already up to date');
        }
        
        // Update last refresh time
        lastRefreshTime = Date.now();
    });
    
    // Add to header
    refreshContainer.appendChild(refreshButton);
    headerElement.appendChild(refreshContainer);
    
    // Add styles
    const style = document.createElement('style');
    style.textContent = `
        .refresh-container {
            position: absolute;
            right: 15px;
            top: 15px;
        }
        .refresh-button {
            background-color: #2a475e;
            color: white;
            border: none;
            border-radius: 4px;
            padding: 8px 12px;
            font-size: 14px;
            cursor: pointer;
            display: flex;
            align-items: center;
            transition: background-color 0.2s;
        }
        .refresh-button:hover {
            background-color: #3a6a8e;
        }
        .refresh-icon {
            display: inline-block;
            margin-right: 6px;
            font-size: 16px;
        }
        .spinning {
            animation: spin 1s linear infinite;
        }
        @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
        .message-toast {
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background-color: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 10px 20px;
            border-radius: 4px;
            z-index: 1000;
            animation: fadeInOut 3s ease-in-out;
        }
        @keyframes fadeInOut {
            0% { opacity: 0; }
            10% { opacity: 1; }
            90% { opacity: 1; }
            100% { opacity: 0; }
        }
    `;
    document.head.appendChild(style);
}

// Show a temporary message toast
function showMessage(message) {
    // Remove any existing message
    const existingMessage = document.querySelector('.message-toast');
    if (existingMessage) {
        existingMessage.remove();
    }
    
    // Create message element
    const messageElement = document.createElement('div');
    messageElement.className = 'message-toast';
    messageElement.textContent = message;
    
    // Add to body
    document.body.appendChild(messageElement);
    
    // Remove after animation
    setTimeout(() => {
        messageElement.remove();
    }, 3000);
}

// Refresh the server list
async function refreshServerList(forceRefresh = false) {
    if (isRefreshing) return false;
    
    isRefreshing = true;
    try {
        // Get the server list from the backend
        let newServers;
        
        if (forceRefresh) {
            // Use the refresh_servers command to force a refresh
            newServers = await refreshServersFromBackend();
        } else {
            // Use the regular get_servers command
            newServers = await getServers();
        }
        
        // Process servers to add flags and country codes
        newServers = processServerData(newServers);
        
        // Check if we have new servers
        const hasChanges = !servers || Object.keys(servers).length !== Object.keys(newServers).length;
        
        // Update servers
        servers = newServers;
        
        // Render the server list
        renderServerList(servers);
        
        // Update last refresh time
        lastRefreshTime = Date.now();
        
        isRefreshing = false;
        return hasChanges;
    } catch (error) {
        console.error('Error refreshing server list:', error);
        
        // Fallback to hardcoded servers if backend fails
        if (Object.keys(servers).length === 0) {
            servers = getFallbackServers();
            renderServerList(servers);
        }
        
        isRefreshing = false;
        return false;
    }
}

// Process server data to add flags and country codes
function processServerData(serverData) {
    const processedServers = {};
    
    for (const [id, server] of Object.entries(serverData)) {
        // Extract country code from name if not present
        if (!server.country_code && server.name) {
            // Try to extract country code from name (e.g., "US East" -> "US")
            const countryMatch = server.name.match(/^([A-Z]{2})\s/);
            if (countryMatch) {
                server.country_code = countryMatch[1];
            } else if (server.country) {
                // Use first two letters of country as code
                server.country_code = server.country.substring(0, 2).toUpperCase();
            } else {
                server.country_code = 'XX';
            }
        }
        
        // Add flag emoji based on country code
        if (!server.flag && server.country_code) {
            server.flag = getCountryFlag(server.country_code);
        }
        
        // Ensure server has a region
        if (!server.region) {
            if (server.name && server.name.includes('US')) {
                server.region = 'US';
            } else if (server.country_code === 'US') {
                server.region = 'US';
            } else if (server.country && ['Germany', 'France', 'UK', 'Sweden', 'Netherlands', 'Spain', 'Finland', 'Austria', 'Poland', 'Russia'].includes(server.country)) {
                server.region = 'Europe';
            } else {
                server.region = 'Other';
            }
        }
        
        processedServers[id] = server;
    }
    
    return processedServers;
}

// Get country flag from country code
function getCountryFlag(countryCode) {
    if (!countryCode || countryCode === 'XX') {
        return '<div class="server-flag flag-XX"></div>';
    }
    
    // Ensure country code is uppercase
    countryCode = countryCode.toUpperCase();
    
    // Return flag div with proper class
    return `<div class="server-flag flag-${countryCode}"></div>`;
}

// Get fallback servers if backend fails
function getFallbackServers() {
    return {};
}

// Get the server list from the backend
async function getServers() {
    try {
        const { invoke } = window.__TAURI__.tauri;
        const result = await invoke('get_servers');
        
        // Check if result is empty or invalid
        if (!result || typeof result !== 'object' || Object.keys(result).length === 0) {
            console.warn('Backend returned empty or invalid server list, using fallback data');
            return getFallbackServers();
        }
        
        return result;
    } catch (error) {
        console.error('Error getting servers:', error);
        return getFallbackServers();
    }
}

// Force refresh the server list from the backend
async function refreshServersFromBackend() {
    try {
        const { invoke } = window.__TAURI__.tauri;
        const result = await invoke('refresh_servers');
        
        // Check if result is empty or invalid
        if (!result || typeof result !== 'object' || Object.keys(result).length === 0) {
            console.warn('Backend returned empty or invalid server list, using fallback data');
            return getFallbackServers();
        }
        
        return result;
    } catch (error) {
        console.error('Error refreshing servers:', error);
        return getFallbackServers();
    }
}

// Render the server list
function renderServerList(servers) {
    const serverListElement = document.getElementById('server-list');
    if (!serverListElement) {
        console.error('Server list element not found');
        return;
    }
    
    // Clear the current list
    serverListElement.innerHTML = '';
    
    // Group servers by region
    const regions = {};
    Object.entries(servers).forEach(([serverId, server]) => {
        const region = server.region || 'Other';
        if (!regions[region]) {
            regions[region] = [];
        }
        regions[region].push({ id: serverId, ...server });
    });
    
    // Sort regions
    const sortedRegions = Object.keys(regions).sort((a, b) => {
        const order = ['North America', 'Europe', 'Asia', 'South America', 'Australia', 'Other'];
        return order.indexOf(a) - order.indexOf(b);
    });
    
    // Render each region
    sortedRegions.forEach(region => {
        // Create region header
        const regionHeader = document.createElement('h3');
        regionHeader.className = 'region-header';
        regionHeader.textContent = region;
        serverListElement.appendChild(regionHeader);
        
        // Create server grid
        const serverGrid = document.createElement('div');
        serverGrid.className = 'server-grid';
        
        // Sort servers by name
        const sortedServers = regions[region].sort((a, b) => a.name.localeCompare(b.name));
        
        // Add server buttons
        sortedServers.forEach(server => {
            const serverButton = document.createElement('button');
            serverButton.className = 'server-button';
            serverButton.dataset.serverId = server.id;
            
            const flagDiv = document.createElement('div');
            flagDiv.className = `server-flag flag-${server.country_code}`;
            
            const nameSpan = document.createElement('span');
            nameSpan.className = 'server-name';
            nameSpan.textContent = server.name;
            
            serverButton.appendChild(flagDiv);
            serverButton.appendChild(nameSpan);
            
            if (selectedServer === server.id) {
                serverButton.classList.add('active');
            }
            
            serverButton.addEventListener('click', () => selectServer(server.id));
            serverGrid.appendChild(serverButton);
        });
        
        serverListElement.appendChild(serverGrid);
    });
}

// Select a server
function selectServer(serverId) {
    // Update selected server
    selectedServer = serverId;
    
    // Update UI
    const serverButtons = document.querySelectorAll('.server-button');
    serverButtons.forEach(button => {
        button.classList.toggle('active', button.dataset.serverId === serverId);
    });
    
    // Show loading state
    const resultsElement = document.getElementById('results');
    resultsElement.innerHTML = '<div class="loading">Checking server ping...</div>';
    
    // Get ping for selected server
    getPing(serverId);
}

// Get ping for a server
async function getPing(serverId) {
    try {
        const { invoke } = window.__TAURI__.tauri;
        const server = servers[serverId];
        
        if (!server) {
            throw new Error('Server not found');
        }
        
        if (!server.ip) {
            throw new Error('Server IP address is missing');
        }
        
        // Get ping from backend
        const result = await invoke('get_ping', { server: server.ip });
        console.log(`Ping result for ${server.name}:`, result);
        
        // Store result for reports
        lastPingResults[serverId] = {
            server: server,
            result: result,
            timestamp: Date.now()
        };
        
        // Display result
        displayPingResult(server, result);
    } catch (error) {
        console.error('Error getting ping:', error);
        displayPingError(servers[serverId], error.toString());
    }
}

// Display ping result
function displayPingResult(server, result) {
    const resultsElement = document.getElementById('results');
    
    // Create result container
    const resultContainer = document.createElement('div');
    resultContainer.className = 'ping-result';
    
    // Check if result contains an error
    if (result.includes('Error') || result.includes('error') || result.includes('failed') || result.includes('Failed')) {
        displayPingError(server, result);
        return;
    }
    
    // Extract ping time if available
    let pingTime = null;
    let pingMethod = '';
    
    if (result.includes('TCP')) {
        // TCP connection
        pingMethod = 'TCP';
        const match = result.match(/(\d+)ms \(TCP\)/);
        if (match) {
            pingTime = parseInt(match[1], 10);
        }
    } else if (result.includes('ICMP')) {
        // ICMP ping
        pingMethod = 'ICMP';
        const match = result.match(/(\d+)ms \(ICMP\)/);
        if (match) {
            pingTime = parseInt(match[1], 10);
        }
    }
    
    // Create server info with proper flag display
    const serverInfo = document.createElement('h3');
    serverInfo.style.display = 'flex';
    serverInfo.style.alignItems = 'center';
    serverInfo.style.gap = '8px';
    
    const flagDiv = document.createElement('div');
    flagDiv.className = `server-flag flag-${server.country_code || 'XX'}`;
    flagDiv.style.width = '24px';
    flagDiv.style.height = '16px';
    flagDiv.style.flexShrink = '0';
    
    const serverName = document.createElement('span');
    serverName.textContent = server.name || 'Unknown Server';
    
    serverInfo.appendChild(flagDiv);
    serverInfo.appendChild(serverName);
    resultContainer.appendChild(serverInfo);
    
    // Create IP info
    const ipInfo = document.createElement('p');
    ipInfo.textContent = `IP: ${server.ip || 'Unknown'}`;
    resultContainer.appendChild(ipInfo);
    
    // Create ping value
    if (pingTime !== null) {
        const pingValue = document.createElement('div');
        pingValue.className = 'ping-value';
        
        // Add class based on ping time
        if (pingTime < 50) {
            pingValue.classList.add('ping-excellent');
        } else if (pingTime < 70) {
            pingValue.classList.add('ping-good');
        } else if (pingTime < 100) {
            pingValue.classList.add('ping-medium');
        } else {
            pingValue.classList.add('ping-bad');
        }
        
        pingValue.textContent = `${pingTime}ms`;
        resultContainer.appendChild(pingValue);
        
        // Add ping quality description
        const pingQuality = document.createElement('div');
        pingQuality.className = 'ping-quality';
        
        if (pingTime < 50) {
            pingQuality.textContent = 'Excellent connection';
        } else if (pingTime < 70) {
            pingQuality.textContent = 'Good connection';
        } else if (pingTime < 100) {
            pingQuality.textContent = 'Average connection';
        } else {
            pingQuality.textContent = 'Poor connection';
        }
        
        resultContainer.appendChild(pingQuality);
    } else {
        // If we couldn't extract ping time, show the raw result
        const rawResult = document.createElement('div');
        rawResult.className = 'ping-value';
        rawResult.textContent = result;
        resultContainer.appendChild(rawResult);
    }
    
    // Add ping method indicator
    if (pingMethod) {
        const methodIndicator = document.createElement('div');
        methodIndicator.className = 'ping-method';
        methodIndicator.textContent = `${pingMethod} Connection`;
        resultContainer.appendChild(methodIndicator);
    }
    
    // Add connection details
    const connectionDetails = document.createElement('details');
    connectionDetails.className = 'connection-details';
    
    const connectionSummary = document.createElement('summary');
    connectionSummary.textContent = 'Connection Details';
    connectionDetails.appendChild(connectionSummary);
    
    const connectionInfo = document.createElement('div');
    connectionInfo.className = 'connection-info';
    
    // Add server location
    if (server.country) {
        const locationInfo = document.createElement('p');
        locationInfo.textContent = `Location: ${server.country}${server.city ? `, ${server.city}` : ''}`;
        connectionInfo.appendChild(locationInfo);
    }
    
    // Add connection type
    const connectionType = document.createElement('p');
    connectionType.textContent = `Connection Type: ${pingMethod === 'TCP' ? 'Direct TCP connection' : 'ICMP ping'}`;
    connectionInfo.appendChild(connectionType);
    
    // Add raw result
    const rawResult = document.createElement('p');
    rawResult.textContent = `Raw Result: ${result}`;
    connectionInfo.appendChild(rawResult);
    
    connectionDetails.appendChild(connectionInfo);
    resultContainer.appendChild(connectionDetails);
    
    // Add retry button
    const retryButton = document.createElement('button');
    retryButton.className = 'retry-button';
    retryButton.textContent = 'Check Again';
    retryButton.addEventListener('click', () => selectServer(server.id));
    resultContainer.appendChild(retryButton);
    
    // Update results element
    resultsElement.innerHTML = '';
    resultsElement.appendChild(resultContainer);
}

// Display ping error
function displayPingError(server, errorMessage) {
    const resultsElement = document.getElementById('results');
    
    // Create result container
    const resultContainer = document.createElement('div');
    resultContainer.className = 'ping-result ping-error';
    
    // Create server info
    const serverInfo = document.createElement('h3');
    serverInfo.innerHTML = `${server.flag || '🌐'} ${server.name || 'Unknown Server'}`;
    resultContainer.appendChild(serverInfo);
    
    // Create IP info
    const ipInfo = document.createElement('p');
    ipInfo.textContent = `IP: ${server.ip || 'Unknown'}`;
    resultContainer.appendChild(ipInfo);
    
    // Create error message
    const errorElement = document.createElement('div');
    errorElement.className = 'ping-value ping-bad';
    
    // Determine error type and set appropriate message
    let errorType = 'Connection Error';
    let errorTip = 'The server may be down or unreachable.';
    
    if (errorMessage.includes('timeout') || errorMessage.includes('Timeout')) {
        errorType = 'Connection Timeout';
        errorTip = 'The server did not respond within the time limit. This could be due to network congestion or server issues.';
        resultContainer.classList.add('ping-timeout');
    } else if (errorMessage.includes('resolve') || errorMessage.includes('DNS')) {
        errorType = 'DNS Resolution Error';
        errorTip = 'Could not resolve the server address. This could be a DNS issue with your network.';
        resultContainer.classList.add('ping-dns-error');
    } else if (errorMessage.includes('permission') || errorMessage.includes('Permission')) {
        errorType = 'Permission Error';
        errorTip = 'The application does not have sufficient permissions to perform the ping operation. Try running as administrator.';
        resultContainer.classList.add('ping-permission-error');
    } else if (errorMessage.includes('network') || errorMessage.includes('Network')) {
        errorType = 'Network Error';
        errorTip = 'There was a problem with your network connection. Check your internet connection and try again.';
        resultContainer.classList.add('ping-network-error');
    }
    
    errorElement.textContent = errorType;
    resultContainer.appendChild(errorElement);
    
    // Add error tip
    const tipElement = document.createElement('div');
    tipElement.className = 'error-tip';
    tipElement.textContent = errorTip;
    resultContainer.appendChild(tipElement);
    
    // Add technical details
    const detailsElement = document.createElement('details');
    detailsElement.className = 'error-details';
    
    const detailsSummary = document.createElement('summary');
    detailsSummary.textContent = 'Technical Details';
    detailsElement.appendChild(detailsSummary);
    
    const detailsPre = document.createElement('pre');
    detailsPre.textContent = errorMessage;
    detailsElement.appendChild(detailsPre);
    
    resultContainer.appendChild(detailsElement);
    
    // Add retry button
    const retryButton = document.createElement('button');
    retryButton.className = 'retry-button';
    retryButton.textContent = 'Try Again';
    retryButton.addEventListener('click', () => selectServer(server.id));
    resultContainer.appendChild(retryButton);
    
    // Update results element
    resultsElement.innerHTML = '';
    resultsElement.appendChild(resultContainer);
}

// Check all servers
async function checkAllServers() {
    // Show loading state
    const resultsElement = document.getElementById('results');
    resultsElement.innerHTML = '<div class="loading">Checking all servers...</div>';
    
    // Clear previous results
    lastPingResults = {};
    
    // Get all server IDs
    const serverIds = Object.keys(servers);
    
    // Create a container for all results
    const allResultsContainer = document.createElement('div');
    allResultsContainer.className = 'connectivity-report';
    
    // Create header with progress
    const header = document.createElement('h3');
    header.textContent = 'Checking All Servers (0%)';
    allResultsContainer.appendChild(header);
    
    // Create results grid
    const resultsGrid = document.createElement('div');
    resultsGrid.className = 'results-grid';
    allResultsContainer.appendChild(resultsGrid);
    
    // Initialize server items
    for (const serverId of serverIds) {
        const server = servers[serverId];
        const serverItem = createServerResultItem(server);
        serverItem.dataset.serverId = serverId;
        resultsGrid.appendChild(serverItem);
    }
    
    // Update results element with the container
    resultsElement.innerHTML = '';
    resultsElement.appendChild(allResultsContainer);
    
    // Track progress
    let completedChecks = 0;
    let successfulChecks = 0;
    
    // Function to update progress
    const updateProgress = () => {
        const progress = Math.round((completedChecks / serverIds.length) * 100);
        header.textContent = `Checking All Servers (${progress}%) - ${successfulChecks} successful`;
    };
    
    // Check all servers with small delays between each
    const checkPromises = serverIds.map((serverId, index) => {
        return new Promise(async (resolve) => {
            // Add small delay between checks
            await new Promise(r => setTimeout(r, index * 100));
            
            try {
                const server = servers[serverId];
                const result = await getPingForServer(server);
                
                // Store result
                lastPingResults[serverId] = {
                    server: server,
                    result: result,
                    timestamp: Date.now()
                };
                
                // Update UI for this server
                const serverItem = document.querySelector(`.results-grid [data-server-id="${serverId}"]`);
                if (serverItem) {
                    updateServerResultItem(serverItem, server, result);
                }
                
                // Update counters
                if (!result.includes('Error') && !result.includes('error') && 
                    !result.includes('failed') && !result.includes('Failed') &&
                    !result.includes('timeout') && !result.includes('Timeout')) {
                    successfulChecks++;
                }
            } catch (error) {
                console.error(`Error checking ${servers[serverId].name}:`, error);
                const serverItem = document.querySelector(`.results-grid [data-server-id="${serverId}"]`);
                if (serverItem) {
                    updateServerResultItem(serverItem, servers[serverId], 'Error: ' + error.message);
                }
            }
            
            completedChecks++;
            updateProgress();
            resolve();
        });
    });
    
    // Wait for all checks to complete
    await Promise.all(checkPromises);
    
    // Update final header
    header.textContent = `All Servers Checked - ${successfulChecks} successful, ${serverIds.length - successfulChecks} failed`;
    
    // Add refresh button
    const refreshButton = document.createElement('button');
    refreshButton.className = 'retry-button';
    refreshButton.textContent = 'Check All Again';
    refreshButton.addEventListener('click', checkAllServers);
    allResultsContainer.appendChild(refreshButton);
}

// Helper function to create a server result item
function createServerResultItem(server) {
    const item = document.createElement('div');
    item.className = 'server-result-item';
    
    const serverInfo = document.createElement('div');
    serverInfo.className = 'server-info';
    
    const flagDiv = document.createElement('div');
    flagDiv.className = `server-flag flag-${server.country_code || 'XX'}`;
    
    const nameSpan = document.createElement('span');
    nameSpan.textContent = server.name;
    
    serverInfo.appendChild(flagDiv);
    serverInfo.appendChild(nameSpan);
    
    const status = document.createElement('div');
    status.className = 'status';
    status.textContent = 'Waiting...';
    
    item.appendChild(serverInfo);
    item.appendChild(status);
    
    return item;
}

// Helper function to update a server result item
function updateServerResultItem(item, server, result) {
    const status = item.querySelector('.status');
    if (!status) return;
    
    // Extract ping time if available
    let pingTime = null;
    if (result.includes('TCP')) {
        const match = result.match(/(\d+)ms \(TCP\)/);
        if (match) pingTime = parseInt(match[1], 10);
    } else if (result.includes('ICMP')) {
        const match = result.match(/(\d+)ms \(ICMP\)/);
        if (match) pingTime = parseInt(match[1], 10);
    }
    
    if (!result.includes('Error') && !result.includes('error') && 
        !result.includes('failed') && !result.includes('Failed') &&
        !result.includes('timeout') && !result.includes('Timeout')) {
        status.className = 'status success';
        status.textContent = pingTime ? `${pingTime}ms` : result;
        
        if (pingTime) {
            if (pingTime < 50) status.classList.add('ping-excellent');
            else if (pingTime < 70) status.classList.add('ping-good');
            else if (pingTime < 100) status.classList.add('ping-medium');
            else status.classList.add('ping-bad');
        }
    } else {
        status.className = 'status error';
        status.textContent = 'Failed';
    }
}

// Get ping for a server (Promise-based version for sequential calls)
async function getPingForServer(server) {
    try {
        const { invoke } = window.__TAURI__.tauri;
        
        if (!server) {
            throw new Error('Server not found');
        }
        
        if (!server.ip) {
            throw new Error('Server IP address is missing');
        }
        
        // Get ping from backend
        const result = await invoke('get_ping', { server: server.ip });
        console.log(`Ping result for ${server.name}:`, result);
        
        return result;
    } catch (error) {
        console.error('Error getting ping:', error);
        throw error;
    }
}

// Generate connectivity report
function generateConnectivityReport() {
    const resultsElement = document.getElementById('results');
    
    // Create report container
    const reportContainer = document.createElement('div');
    reportContainer.className = 'connectivity-report';
    
    // Create report header
    const reportHeader = document.createElement('h3');
    reportHeader.textContent = 'Connectivity Report';
    reportContainer.appendChild(reportHeader);
    
    // Create summary section
    const summarySection = document.createElement('div');
    summarySection.className = 'report-section';
    
    const summaryHeader = document.createElement('h4');
    summaryHeader.textContent = 'Summary';
    summarySection.appendChild(summaryHeader);
    
    // Check if we have any ping results
    if (Object.keys(lastPingResults).length === 0) {
        const noDataMessage = document.createElement('p');
        noDataMessage.textContent = 'No ping data available. Please check at least one server first.';
        summarySection.appendChild(noDataMessage);
        
        reportContainer.appendChild(summarySection);
        resultsElement.innerHTML = '';
        resultsElement.appendChild(reportContainer);
        
        // Add refresh button
        const refreshButton = document.createElement('button');
        refreshButton.className = 'retry-button';
        refreshButton.textContent = 'Check All Servers';
        refreshButton.addEventListener('click', checkAllServers);
        reportContainer.appendChild(refreshButton);
        
        return;
    }
    
    // Calculate summary statistics
    let successfulPings = 0;
    let failedPings = 0;
    let allPingTimes = [];

    // Check for stale results (older than 10 minutes)
    const now = Date.now();
    const staleThreshold = 10 * 60 * 1000; // 10 minutes
    let hasStaleResults = false;
    
    for (const [serverId, result] of Object.entries(lastPingResults)) {
        // Check if result is stale
        if (now - result.timestamp > staleThreshold) {
            hasStaleResults = true;
        }
        
        if (!result.result.includes('Error') && !result.result.includes('error') && 
            !result.result.includes('failed') && !result.result.includes('Failed') &&
            !result.result.includes('timeout') && !result.result.includes('Timeout')) {
            successfulPings++;
            
            // Extract ping time if available
            let pingTime = null;
            
            if (result.result.includes('TCP')) {
                const match = result.result.match(/(\d+)ms \(TCP\)/);
                if (match) {
                    pingTime = parseInt(match[1], 10);
                }
            } else if (result.result.includes('ICMP')) {
                const match = result.result.match(/(\d+)ms \(ICMP\)/);
                if (match) {
                    pingTime = parseInt(match[1], 10);
                }
            }
            
            if (pingTime !== null) {
                allPingTimes.push(pingTime);
            }
        } else {
            failedPings++;
        }
    }
    
    // Calculate average of lowest 3 pings
    let averagePing = null;
    if (allPingTimes.length > 0) {
        allPingTimes.sort((a, b) => a - b);
        const lowestThree = allPingTimes.slice(0, 3);
        if (lowestThree.length > 0) {
            averagePing = Math.round(lowestThree.reduce((a, b) => a + b) / lowestThree.length);
        }
    }
    
    // Add summary info
    const summaryInfo = document.createElement('p');
    summaryInfo.innerHTML = `
        <strong>Servers Checked:</strong> ${Object.keys(lastPingResults).length}<br>
        <strong>Successful Connections:</strong> ${successfulPings}<br>
        <strong>Failed Connections:</strong> ${failedPings}<br>
        ${averagePing !== null ? `<strong>Average Ping:</strong> ${averagePing}ms` : ''}
    `;
    summarySection.appendChild(summaryInfo);
    
    // Add overall status
    const overallStatus = document.createElement('p');
    let statusMessage = '';
    
    if (failedPings === 0) {
        statusMessage = 'All servers are reachable. Your connection appears to be working well.';
    } else if (successfulPings === 0) {
        statusMessage = 'No servers are reachable. You may have connectivity issues.';
    } else if (failedPings > successfulPings) {
        statusMessage = 'Most servers are unreachable. You may have partial connectivity issues.';
    } else {
        statusMessage = 'Some servers are unreachable. This could be due to regional network issues.';
    }
    
    overallStatus.innerHTML = `<strong>Status:</strong> ${statusMessage}`;
    summarySection.appendChild(overallStatus);
    
    // Add stale data warning if needed
    if (hasStaleResults) {
        const staleWarning = document.createElement('p');
        staleWarning.innerHTML = '<strong>Note:</strong> Some of the ping results are more than 10 minutes old and may not reflect current conditions.';
        staleWarning.style.color = '#ff9800';
        summarySection.appendChild(staleWarning);
    }
    
    reportContainer.appendChild(summarySection);
    
    // Create detailed results section
    const detailedSection = document.createElement('div');
    detailedSection.className = 'report-section';
    
    const detailedHeader = document.createElement('h4');
    detailedHeader.textContent = 'Detailed Results';
    detailedSection.appendChild(detailedHeader);
    
    // Group results by region
    const regionResults = {};
    
    for (const [serverId, result] of Object.entries(lastPingResults)) {
        const region = result.server.region || 'Other';
        if (!regionResults[region]) {
            regionResults[region] = [];
        }
        regionResults[region].push({ id: serverId, ...result });
    }
    
    // Sort regions
    const sortedRegions = Object.keys(regionResults).sort((a, b) => {
        // Custom sort order
        const order = ['Europe', 'US', 'Asia', 'South America', 'Australia', 'Other'];
        return order.indexOf(a) - order.indexOf(b);
    });
    
    // Add results for each region
    for (const region of sortedRegions) {
        const regionSection = document.createElement('div');
        regionSection.className = 'report-region';
        
        const regionHeader = document.createElement('h5');
        regionHeader.textContent = region;
        regionSection.appendChild(regionHeader);
        
        // Sort servers within region
        const sortedServers = regionResults[region].sort((a, b) => {
            return a.server.country_code?.localeCompare(b.server.country_code) || 0;
        });
        
        // Add server results
        for (const serverResult of sortedServers) {
            const reportItem = document.createElement('div');
            reportItem.className = 'report-item';
            
            // Determine status
            const isSuccess = !serverResult.result.includes('Error') && 
                            !serverResult.result.includes('error') && 
                            !serverResult.result.includes('failed') && 
                            !serverResult.result.includes('Failed') &&
                            !serverResult.result.includes('timeout') && 
                            !serverResult.result.includes('Timeout');
            
            // Create status indicator
            const statusIndicator = document.createElement('div');
            statusIndicator.className = 'report-status';
            
            if (isSuccess) {
                statusIndicator.classList.add('status-success');
            } else {
                statusIndicator.classList.add('status-error');
            }
            
            reportItem.appendChild(statusIndicator);
            
            // Create server info
            const serverInfo = document.createElement('div');
            serverInfo.className = 'report-server';
            
            const flagDiv = document.createElement('div');
            flagDiv.className = `server-flag flag-${serverResult.server.country_code || 'XX'}`;
            serverInfo.appendChild(flagDiv);
            
            const serverName = document.createElement('span');
            serverName.textContent = serverResult.server.name;
            serverInfo.appendChild(serverName);
            
            reportItem.appendChild(serverInfo);
            
            // Create latency info
            const latencyInfo = document.createElement('div');
            latencyInfo.className = 'report-latency';
            
            if (isSuccess) {
                // Extract ping time if available
                let pingTime = null;
                
                if (serverResult.result.includes('TCP')) {
                    const match = serverResult.result.match(/(\d+)ms \(TCP\)/);
                    if (match) {
                        pingTime = parseInt(match[1], 10);
                    }
                } else if (serverResult.result.includes('ICMP')) {
                    const match = serverResult.result.match(/(\d+)ms \(ICMP\)/);
                    if (match) {
                        pingTime = parseInt(match[1], 10);
                    }
                }
                
                if (pingTime !== null) {
                    latencyInfo.textContent = `${pingTime}ms`;
                    
                    // Add class based on ping time
                    if (pingTime < 50) {
                        latencyInfo.classList.add('ping-excellent');
                    } else if (pingTime < 70) {
                        latencyInfo.classList.add('ping-good');
                    } else if (pingTime < 100) {
                        latencyInfo.classList.add('ping-medium');
                    } else {
                        latencyInfo.classList.add('ping-bad');
                    }
                } else {
                    latencyInfo.textContent = serverResult.result;
                }
            } else {
                latencyInfo.textContent = 'Failed';
                latencyInfo.classList.add('ping-bad');
            }
            
            // Add timestamp
            if (serverResult.timestamp) {
                const age = now - serverResult.timestamp;
                const minutes = Math.floor(age / 60000);
                
                if (minutes > 0) {
                    const timeIndicator = document.createElement('span');
                    timeIndicator.style.fontSize = '11px';
                    timeIndicator.style.opacity = '0.7';
                    timeIndicator.style.marginLeft = '5px';
                    timeIndicator.textContent = `(${minutes}m ago)`;
                    latencyInfo.appendChild(timeIndicator);
                }
            }
            
            reportItem.appendChild(latencyInfo);
            
            // Add click event to recheck this server
            reportItem.style.cursor = 'pointer';
            reportItem.addEventListener('click', () => selectServer(serverResult.id));
            
            regionSection.appendChild(reportItem);
        }
        
        detailedSection.appendChild(regionSection);
    }
    
    reportContainer.appendChild(detailedSection);
    
    // Create troubleshooting section
    const troubleshootingSection = document.createElement('div');
    troubleshootingSection.className = 'report-section';
    
    const troubleshootingHeader = document.createElement('h4');
    troubleshootingHeader.textContent = 'Troubleshooting Tips';
    troubleshootingSection.appendChild(troubleshootingHeader);
    
    const tipsList = document.createElement('ul');
    tipsList.className = 'tips-list';
    
    // Add tips based on results
    if (failedPings > 0) {
        const tips = [
            'Check your internet connection and make sure it\'s stable.',
            'Try restarting your router or modem if you\'re experiencing widespread connectivity issues.',
            'Some ISPs may block ICMP ping packets. Try using a different network if possible.',
            'If only specific regions are unreachable, it could be due to routing issues with your ISP.',
            'Temporarily disable your firewall to check if it\'s blocking the connections.',
            'Try running the application as administrator for better network access.'
        ];
        
        for (const tip of tips) {
            const tipItem = document.createElement('li');
            tipItem.textContent = tip;
            tipsList.appendChild(tipItem);
        }
    } else {
        const tipItem = document.createElement('li');
        tipItem.textContent = 'All servers are reachable. No troubleshooting needed!';
        tipsList.appendChild(tipItem);
    }
    
    troubleshootingSection.appendChild(tipsList);
    reportContainer.appendChild(troubleshootingSection);
    
    // Add action buttons
    const actionContainer = document.createElement('div');
    actionContainer.style.display = 'flex';
    actionContainer.style.gap = '10px';
    actionContainer.style.marginTop = '15px';
    
    // Add refresh report button
    const refreshReportButton = document.createElement('button');
    refreshReportButton.className = 'retry-button';
    refreshReportButton.textContent = 'Refresh Report';
    refreshReportButton.addEventListener('click', generateConnectivityReport);
    actionContainer.appendChild(refreshReportButton);
    
    // Add check all servers button
    const checkAllButton = document.createElement('button');
    checkAllButton.className = 'retry-button';
    checkAllButton.textContent = 'Check All Servers';
    checkAllButton.addEventListener('click', checkAllServers);
    actionContainer.appendChild(checkAllButton);
    
    reportContainer.appendChild(actionContainer);
    
    // Update results element
    resultsElement.innerHTML = '';
    resultsElement.appendChild(reportContainer);
}

// Show error message
function showError(message) {
    const resultsElement = document.getElementById('results');
    resultsElement.innerHTML = `<div class="ping-result ping-error"><div class="ping-value ping-bad">Error</div><div class="error-tip">${message}</div></div>`;
}

// Set up custom server check
function setupCustomServerCheck() {
    const customIpInput = document.getElementById('custom-ip');
    const checkCustomServerBtn = document.getElementById('check-custom-server');
    
    const checkCustomServer = async () => {
        const input = customIpInput.value.trim();
        if (!input) {
            showMessage('Please enter a server IP address');
            return;
        }
        
        // Parse input to separate IP and port
        let ip = input;
        let port = null;
        
        // Check for IPv4 with port
        const ipv4PortMatch = input.match(/^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}):(\d+)$/);
        if (ipv4PortMatch) {
            ip = ipv4PortMatch[1];
            port = ipv4PortMatch[2];
        }
        
        // Show loading state
        const resultsElement = document.getElementById('results');
        resultsElement.innerHTML = '<div class="loading">Checking custom server ping...</div>';
        
        try {
            const { invoke } = window.__TAURI__.tauri;
            let result;
            
            // Try without port first
            result = await invoke('get_ping', { server: ip });
            
            // If we have a port and the initial ping worked, try with port too
            let portResult = null;
            if (port) {
                try {
                    portResult = await invoke('get_ping', { server: `${ip}:${port}` });
                } catch (portError) {
                    console.log('Port-specific ping failed:', portError);
                }
            }
            
            // Create a temporary server object
            const customServer = {
                id: 'custom-server',
                name: port ? `Custom Server (${ip}:${port})` : `Custom Server (${ip})`,
                ip: ip,
                port: port,
                flag: '🌐',
                region: 'Custom',
                country_code: 'XX'
            };
            
            // Store results
            lastPingResults['custom-server'] = {
                server: customServer,
                result: result,
                portResult: portResult,
                timestamp: Date.now()
            };
            
            // Display combined results
            displayCustomPingResult(customServer, result, portResult);
        } catch (error) {
            console.error('Error checking custom server:', error);
            
            // If initial ping fails and we have a port, try with port
            if (port) {
                try {
                    const portResult = await invoke('get_ping', { server: `${ip}:${port}` });
                    
                    // Create a temporary server object
                    const customServer = {
                        id: 'custom-server',
                        name: `Custom Server (${ip}:${port})`,
                        ip: ip,
                        port: port,
                        flag: '🌐',
                        region: 'Custom',
                        country_code: 'XX'
                    };
                    
                    // Store and display result
                    lastPingResults['custom-server'] = {
                        server: customServer,
                        result: null,
                        portResult: portResult,
                        timestamp: Date.now()
                    };
                    
                    displayCustomPingResult(customServer, null, portResult);
                    return;
                } catch (portError) {
                    console.error('Port-specific ping also failed:', portError);
                }
            }
            
            displayPingError({
                name: port ? `Custom Server (${ip}:${port})` : `Custom Server (${ip})`,
                ip: ip,
                flag: '🌐'
            }, error.toString());
        }
    };
    
    // Add click event
    checkCustomServerBtn.addEventListener('click', checkCustomServer);
    
    // Add enter key support
    customIpInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            checkCustomServer();
        }
    });
}

// Display custom ping result with both regular and port-specific results
function displayCustomPingResult(server, result, portResult) {
    const resultsElement = document.getElementById('results');
    
    // Create result container
    const resultContainer = document.createElement('div');
    resultContainer.className = 'ping-result';
    
    // Create server info
    const serverInfo = document.createElement('h3');
    serverInfo.innerHTML = `${server.flag || '🌐'} ${server.name || 'Unknown Server'}`;
    resultContainer.appendChild(serverInfo);
    
    // Create IP info
    const ipInfo = document.createElement('p');
    ipInfo.textContent = server.port ? `IP: ${server.ip} (Port: ${server.port})` : `IP: ${server.ip}`;
    resultContainer.appendChild(ipInfo);
    
    // Function to extract ping time
    const extractPingTime = (pingResult) => {
        if (!pingResult) return null;
        let pingTime = null;
        if (pingResult.includes('TCP')) {
            const match = pingResult.match(/(\d+)ms \(TCP\)/);
            if (match) pingTime = parseInt(match[1], 10);
        } else if (pingResult.includes('ICMP')) {
            const match = pingResult.match(/(\d+)ms \(ICMP\)/);
            if (match) pingTime = parseInt(match[1], 10);
        }
        return pingTime;
    };
    
    // Display regular ping result
    if (result) {
        const pingTime = extractPingTime(result);
        if (pingTime !== null) {
            const pingValue = document.createElement('div');
            pingValue.className = 'ping-value';
            if (pingTime < 50) pingValue.classList.add('ping-excellent');
            else if (pingTime < 70) pingValue.classList.add('ping-good');
            else if (pingTime < 100) pingValue.classList.add('ping-medium');
            else pingValue.classList.add('ping-bad');
            pingValue.textContent = `${pingTime}ms`;
            resultContainer.appendChild(pingValue);
        }
    }
    
    // Display port-specific result if available
    if (portResult) {
        const portPingTime = extractPingTime(portResult);
        if (portPingTime !== null) {
            const portPingValue = document.createElement('div');
            portPingValue.className = 'ping-value port-ping';
            if (portPingTime < 50) portPingValue.classList.add('ping-excellent');
            else if (portPingTime < 70) portPingValue.classList.add('ping-good');
            else if (portPingTime < 100) portPingValue.classList.add('ping-medium');
            else portPingValue.classList.add('ping-bad');
            portPingValue.textContent = `${portPingTime}ms (Port ${server.port})`;
            resultContainer.appendChild(portPingValue);
        }
    }
    
    // Add connection details
    const connectionDetails = document.createElement('details');
    connectionDetails.className = 'connection-details';
    
    const connectionSummary = document.createElement('summary');
    connectionSummary.textContent = 'Connection Details';
    connectionDetails.appendChild(connectionSummary);
    
    const connectionInfo = document.createElement('div');
    connectionInfo.className = 'connection-info';
    
    // Add regular ping result
    if (result) {
        const regularPingInfo = document.createElement('p');
        regularPingInfo.textContent = `Regular Ping: ${result}`;
        connectionInfo.appendChild(regularPingInfo);
    }
    
    // Add port-specific result
    if (portResult) {
        const portPingInfo = document.createElement('p');
        portPingInfo.textContent = `Port ${server.port} Ping: ${portResult}`;
        connectionInfo.appendChild(portPingInfo);
    }
    
    connectionDetails.appendChild(connectionInfo);
    resultContainer.appendChild(connectionDetails);
    
    // Add retry button
    const retryButton = document.createElement('button');
    retryButton.className = 'retry-button';
    retryButton.textContent = 'Check Again';
    retryButton.addEventListener('click', () => {
        const customIpInput = document.getElementById('custom-ip');
        customIpInput.value = server.port ? `${server.ip}:${server.port}` : server.ip;
        document.getElementById('check-custom-server').click();
    });
    resultContainer.appendChild(retryButton);
    
    // Update results element
    resultsElement.innerHTML = '';
    resultsElement.appendChild(resultContainer);
} 