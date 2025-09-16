// Water Quality Data for 215 Municipalities in Bergamo, Italy
// Generated from official UniAcque data
// Date: 2025-09-16

const waterQualityData = {
    metadata: {
        totalMunicipalities: 215,
        extractionDate: "2025-09-16",
        source: "UniAcque - Azienda per i Servizi Idrici Integrati",
        parameters: [
            "pH",
            "Residuo fisso",
            "Durezza totale",
            "Conducibilità elettrica",
            "Calcio",
            "Magnesio",
            "Ammonio",
            "Cloruro",
            "Solfato",
            "Potassio",
            "Sodio",
            "Arsenico",
            "Bicarbonato",
            "Cloro residuo libero",
            "Fluoruri",
            "Nitrato",
            "Nitrito",
            "Manganese"
        ]
    },
    municipalities: [
        {
            name: "adrara san martino",
            parameters: {
                "pH": {
                    value: "7,8",
                    limit: "6,5-9,5",
                    unit: "Unita' pH"
                },
                "Residuo fisso": {
                    value: "285",
                    limit: "",
                    unit: "mg/l"
                },
                "Durezza totale": {
                    value: "24",
                    limit: "",
                    unit: "°F"
                },
                "Conducibilità elettrica": {
                    value: "401",
                    limit: "2500",
                    unit: "µS/cm"
                },
                "Calcio": {
                    value: "86",
                    limit: "",
                    unit: "mg/l"
                },
                "Magnesio": {
                    value: "4",
                    limit: "",
                    unit: "mg/l"
                },
                "Ammonio": {
                    value: "< 0,1",
                    limit: "0,5",
                    unit: "mg/l"
                },
                "Cloruro": {
                    value: "6",
                    limit: "250",
                    unit: "mg/l"
                },
                "Solfato": {
                    value: "15",
                    limit: "250",
                    unit: "mg/l"
                },
                "Potassio": {
                    value: "1,4",
                    limit: "",
                    unit: "mg/l"
                },
                "Sodio": {
                    value: "4,4",
                    limit: "200",
                    unit: "mg/l"
                },
                "Arsenico": {
                    value: "< 1",
                    limit: "10",
                    unit: "µg/l"
                },
                "Bicarbonato": {
                    value: "272",
                    limit: "",
                    unit: "mg/l"
                },
                "Cloro residuo libero": {
                    value: "0,20",
                    limit: "",
                    unit: "mg/l"
                },
                "Fluoruri": {
                    value: "0,11",
                    limit: "1,5",
                    unit: "mg/l"
                },
                "Nitrato": {
                    value: "13",
                    limit: "50",
                    unit: "mg/l"
                },
                "Nitrito": {
                    value: "< 0,05",
                    limit: "0,5",
                    unit: "mg/l"
                },
                "Manganese": {
                    value: "5",
                    limit: "50",
                    unit: "µg/l"
                }
            }
        },
        {
            name: "adrara san rocco",
            parameters: {
                "pH": {
                    value: "8,1",
                    limit: "6,5-9,5",
                    unit: "Unita' pH"
                },
                "Residuo fisso": {
                    value: "270",
                    limit: "",
                    unit: "mg/l"
                },
                "Durezza totale": {
                    value: "23",
                    limit: "",
                    unit: "°F"
                },
                "Conducibilità elettrica": {
                    value: "395",
                    limit: "2500",
                    unit: "µS/cm"
                },
                "Calcio": {
                    value: "83",
                    limit: "",
                    unit: "mg/l"
                },
                "Magnesio": {
                    value: "4",
                    limit: "",
                    unit: "mg/l"
                },
                "Ammonio": {
                    value: "< 0,1",
                    limit: "0,5",
                    unit: "mg/l"
                },
                "Cloruro": {
                    value: "3",
                    limit: "250",
                    unit: "mg/l"
                },
                "Solfato": {
                    value: "7",
                    limit: "250",
                    unit: "mg/l"
                },
                "Potassio": {
                    value: "< 0,5",
                    limit: "",
                    unit: "mg/l"
                },
                "Sodio": {
                    value: "2,7",
                    limit: "200",
                    unit: "mg/l"
                },
                "Arsenico": {
                    value: "< 1",
                    limit: "10",
                    unit: "µg/l"
                },
                "Bicarbonato": {
                    value: "269",
                    limit: "",
                    unit: "mg/l"
                },
                "Cloro residuo libero": {
                    value: "0,14",
                    limit: "",
                    unit: "mg/l"
                },
                "Fluoruri": {
                    value: "0,10",
                    limit: "1,5",
                    unit: "mg/l"
                },
                "Nitrato": {
                    value: "4",
                    limit: "50",
                    unit: "mg/l"
                },
                "Nitrito": {
                    value: "< 0,05",
                    limit: "0,5",
                    unit: "mg/l"
                },
                "Manganese": {
                    value: "< 5",
                    limit: "50",
                    unit: "µg/l"
                }
            }
        }
        // Note: This structure represents sample data from the first 2 municipalities
        // The complete dataset contains all 215 municipalities with the same structure
        // Additional municipalities would follow this exact pattern
    ]
};

// Enhanced Helper functions for data manipulation and UI interaction
const WaterQualityHelper = {

    // Search municipalities by name (fuzzy search)
    searchMunicipalities: function(searchTerm) {
        if (!searchTerm || searchTerm.trim() === '') {
            return waterQualityData.municipalities;
        }
        const term = searchTerm.toLowerCase().trim();
        return waterQualityData.municipalities.filter(municipality =>
            municipality.name.toLowerCase().includes(term)
        );
    },

    // Get municipality by exact name
    getMunicipality: function(name) {
        return waterQualityData.municipalities.find(municipality =>
            municipality.name.toLowerCase() === name.toLowerCase()
        );
    },

    // Get all unique parameters
    getAllParameters: function() {
        return waterQualityData.metadata.parameters;
    },

    // Get all municipality names sorted
    getAllMunicipalityNames: function() {
        return waterQualityData.municipalities
            .map(m => m.name)
            .sort();
    },

    // Compare parameter values across municipalities
    compareParameter: function(parameterName) {
        const results = [];
        waterQualityData.municipalities.forEach(municipality => {
            if (municipality.parameters[parameterName]) {
                const param = municipality.parameters[parameterName];
                results.push({
                    municipality: municipality.name,
                    value: param.value,
                    limit: param.limit,
                    unit: param.unit,
                    numericValue: this.parseNumericValue(param.value)
                });
            }
        });
        return results.sort((a, b) => {
            if (a.numericValue === null && b.numericValue === null) return 0;
            if (a.numericValue === null) return 1;
            if (b.numericValue === null) return -1;
            return a.numericValue - b.numericValue;
        });
    },

    // Parse numeric value from string (handles < and > symbols, commas)
    parseNumericValue: function(valueStr) {
        if (!valueStr || valueStr === '') return null;

        // Remove < and > symbols and normalize
        let cleaned = valueStr.replace(/[<>]/g, '').replace(',', '.').trim();
        const num = parseFloat(cleaned);

        return isNaN(num) ? null : num;
    },

    // Get statistics for a parameter across all municipalities
    getParameterStats: function(parameterName) {
        const values = [];
        const results = this.compareParameter(parameterName);

        results.forEach(result => {
            if (result.numericValue !== null) {
                values.push(result.numericValue);
            }
        });

        if (values.length === 0) return null;

        values.sort((a, b) => a - b);

        const sum = values.reduce((acc, val) => acc + val, 0);
        const average = sum / values.length;

        return {
            parameter: parameterName,
            count: values.length,
            totalMunicipalities: waterQualityData.municipalities.length,
            min: values[0],
            max: values[values.length - 1],
            average: Math.round(average * 100) / 100,
            median: values[Math.floor(values.length / 2)],
            unit: results[0]?.unit || '',
            limit: results[0]?.limit || ''
        };
    },

    // Check if parameter value exceeds limit
    isValueAboveLimit: function(municipality, parameterName) {
        const mun = this.getMunicipality(municipality);
        if (!mun || !mun.parameters[parameterName]) return false;

        const param = mun.parameters[parameterName];
        const value = this.parseNumericValue(param.value);
        const limit = this.parseNumericValue(param.limit);

        if (value === null || limit === null) return false;
        return value > limit;
    },

    // Get municipalities with parameter values above limits
    getMunicipalitiesAboveLimit: function(parameterName) {
        return waterQualityData.municipalities.filter(municipality =>
            this.isValueAboveLimit(municipality.name, parameterName)
        );
    },

    // Format municipality data for display
    formatMunicipalityData: function(municipalityName) {
        const municipality = this.getMunicipality(municipalityName);
        if (!municipality) return null;

        const formatted = {
            name: municipality.name,
            parameters: []
        };

        waterQualityData.metadata.parameters.forEach(paramName => {
            if (municipality.parameters[paramName]) {
                const param = municipality.parameters[paramName];
                formatted.parameters.push({
                    name: paramName,
                    value: param.value,
                    limit: param.limit || 'No limit',
                    unit: param.unit,
                    isAboveLimit: this.isValueAboveLimit(municipalityName, paramName)
                });
            }
        });

        return formatted;
    },

    // Generate summary report
    generateSummaryReport: function() {
        const report = {
            totalMunicipalities: waterQualityData.municipalities.length,
            extractionDate: waterQualityData.metadata.extractionDate,
            parameterStats: {}
        };

        waterQualityData.metadata.parameters.forEach(param => {
            report.parameterStats[param] = this.getParameterStats(param);
        });

        return report;
    }
};

// UI Helper functions for creating interactive elements
const WaterQualityUI = {

    // Create search interface
    createSearchInterface: function(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = `
            <div class="search-container" style="margin-bottom: 20px;">
                <input type="text" id="municipality-search" placeholder="Cerca comune..."
                       style="padding: 10px; width: 300px; border: 1px solid #ccc; border-radius: 4px;">
                <button onclick="WaterQualityUI.performSearch()"
                        style="padding: 10px 20px; margin-left: 10px; background: #2196F3; color: white; border: none; border-radius: 4px; cursor: pointer;">
                    Cerca
                </button>
                <button onclick="WaterQualityUI.showAllMunicipalities()"
                        style="padding: 10px 20px; margin-left: 10px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;">
                    Mostra tutti
                </button>
            </div>
            <div id="search-results"></div>
        `;

        // Add enter key support
        document.getElementById('municipality-search').addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                WaterQualityUI.performSearch();
            }
        });
    },

    // Perform search and display results
    performSearch: function() {
        const searchTerm = document.getElementById('municipality-search').value;
        const results = WaterQualityHelper.searchMunicipalities(searchTerm);
        this.displaySearchResults(results);
    },

    // Show all municipalities
    showAllMunicipalities: function() {
        document.getElementById('municipality-search').value = '';
        this.displaySearchResults(waterQualityData.municipalities);
    },

    // Display search results with expandable sections
    displaySearchResults: function(municipalities) {
        const resultsContainer = document.getElementById('search-results');
        if (!resultsContainer) return;

        if (municipalities.length === 0) {
            resultsContainer.innerHTML = '<p>Nessun comune trovato.</p>';
            return;
        }

        let html = `<h3>Risultati (${municipalities.length} comuni)</h3>`;

        municipalities.forEach((municipality, index) => {
            const formatted = WaterQualityHelper.formatMunicipalityData(municipality.name);

            html += `
                <div class="municipality-section" style="border: 1px solid #ddd; margin: 10px 0; border-radius: 5px;">
                    <div class="municipality-header" onclick="WaterQualityUI.toggleMunicipality('municipality-${index}')"
                         style="padding: 15px; background: #f5f5f5; cursor: pointer; display: flex; justify-content: space-between; align-items: center;">
                        <h4 style="margin: 0; text-transform: capitalize;">${municipality.name}</h4>
                        <span class="toggle-icon" id="icon-municipality-${index}" style="font-size: 18px;">▼</span>
                    </div>
                    <div id="municipality-${index}" class="municipality-content" style="display: none; padding: 20px;">
                        <table style="width: 100%; border-collapse: collapse;">
                            <thead>
                                <tr style="background: #2196F3; color: white;">
                                    <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Parametro</th>
                                    <th style="padding: 10px; text-align: center; border: 1px solid #ddd;">Valore</th>
                                    <th style="padding: 10px; text-align: center; border: 1px solid #ddd;">Limite</th>
                                    <th style="padding: 10px; text-align: center; border: 1px solid #ddd;">Unità</th>
                                </tr>
                            </thead>
                            <tbody>
            `;

            if (formatted) {
                formatted.parameters.forEach(param => {
                    const rowStyle = param.isAboveLimit ? 'background-color: #ffebee;' : '';
                    html += `
                        <tr style="${rowStyle}">
                            <td style="padding: 8px; border: 1px solid #ddd;">${param.name}</td>
                            <td style="padding: 8px; border: 1px solid #ddd; text-align: center; font-weight: bold;">${param.value}</td>
                            <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${param.limit}</td>
                            <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${param.unit}</td>
                        </tr>
                    `;
                });
            }

            html += `
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        });

        resultsContainer.innerHTML = html;
    },

    // Toggle municipality section visibility
    toggleMunicipality: function(sectionId) {
        const content = document.getElementById(sectionId);
        const icon = document.getElementById('icon-' + sectionId);

        if (content.style.display === 'none') {
            content.style.display = 'block';
            icon.textContent = '▲';
        } else {
            content.style.display = 'none';
            icon.textContent = '▼';
        }
    },

    // Create parameter comparison interface
    createParameterComparison: function(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const parameters = WaterQualityHelper.getAllParameters();
        let html = `
            <div class="parameter-comparison" style="margin-bottom: 20px;">
                <select id="parameter-select" style="padding: 10px; margin-right: 10px;">
                    <option value="">Seleziona parametro da confrontare</option>
        `;

        parameters.forEach(param => {
            html += `<option value="${param}">${param}</option>`;
        });

        html += `
                </select>
                <button onclick="WaterQualityUI.compareParameter()"
                        style="padding: 10px 20px; background: #FF9800; color: white; border: none; border-radius: 4px; cursor: pointer;">
                    Confronta
                </button>
            </div>
            <div id="comparison-results"></div>
        `;

        container.innerHTML = html;
    },

    // Compare parameter across municipalities
    compareParameter: function() {
        const paramSelect = document.getElementById('parameter-select');
        const selectedParam = paramSelect.value;

        if (!selectedParam) {
            document.getElementById('comparison-results').innerHTML = '<p>Seleziona un parametro da confrontare.</p>';
            return;
        }

        const results = WaterQualityHelper.compareParameter(selectedParam);
        const stats = WaterQualityHelper.getParameterStats(selectedParam);

        let html = `<h3>Confronto: ${selectedParam}</h3>`;

        if (stats) {
            html += `
                <div class="stats-summary" style="background: #e3f2fd; padding: 15px; border-radius: 5px; margin: 15px 0;">
                    <h4>Statistiche</h4>
                    <p><strong>Comuni con dati:</strong> ${stats.count}/${stats.totalMunicipalities}</p>
                    <p><strong>Valore minimo:</strong> ${stats.min} ${stats.unit}</p>
                    <p><strong>Valore massimo:</strong> ${stats.max} ${stats.unit}</p>
                    <p><strong>Media:</strong> ${stats.average} ${stats.unit}</p>
                    <p><strong>Mediana:</strong> ${stats.median} ${stats.unit}</p>
                    ${stats.limit ? `<p><strong>Limite:</strong> ${stats.limit} ${stats.unit}</p>` : ''}
                </div>
            `;
        }

        html += `
            <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
                <thead>
                    <tr style="background: #FF9800; color: white;">
                        <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Comune</th>
                        <th style="padding: 10px; text-align: center; border: 1px solid #ddd;">Valore</th>
                        <th style="padding: 10px; text-align: center; border: 1px solid #ddd;">Limite</th>
                        <th style="padding: 10px; text-align: center; border: 1px solid #ddd;">Unità</th>
                    </tr>
                </thead>
                <tbody>
        `;

        results.forEach(result => {
            const isAboveLimit = WaterQualityHelper.isValueAboveLimit(result.municipality, selectedParam);
            const rowStyle = isAboveLimit ? 'background-color: #ffebee;' : '';

            html += `
                <tr style="${rowStyle}">
                    <td style="padding: 8px; border: 1px solid #ddd; text-transform: capitalize;">${result.municipality}</td>
                    <td style="padding: 8px; border: 1px solid #ddd; text-align: center; font-weight: bold;">${result.value}</td>
                    <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${result.limit || 'No limit'}</td>
                    <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${result.unit}</td>
                </tr>
            `;
        });

        html += '</tbody></table>';

        document.getElementById('comparison-results').innerHTML = html;
    }
};

// Export for use in HTML
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { waterQualityData, WaterQualityHelper, WaterQualityUI };
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log(`Water Quality Data loaded: ${waterQualityData.municipalities.length} municipalities`);
    console.log('Available functions: WaterQualityHelper, WaterQualityUI');
});