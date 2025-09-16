// Water Quality Data Management System
// Data source: UniAcque S.p.A. - September 16, 2025

// Water quality limits based on Italian regulations (D.Lgs. 31/2001)
const WATER_QUALITY_LIMITS = {
    'pH': { min: 6.5, max: 9.5, unit: '' },
    'Residuo_fisso_mg_L': { max: 1500, unit: 'mg/L' },
    'Durezza_totale_F': { min: 15, max: 50, unit: '°F' },
    'Conducibilita_uS_cm': { max: 2500, unit: 'µS/cm' },
    'Calcio_mg_L': { max: null, unit: 'mg/L' },
    'Magnesio_mg_L': { max: null, unit: 'mg/L' },
    'Ammonio_mg_L': { max: 0.5, unit: 'mg/L' },
    'Cloruro_mg_L': { max: 250, unit: 'mg/L' },
    'Solfato_mg_L': { max: 250, unit: 'mg/L' },
    'Potassio_mg_L': { max: null, unit: 'mg/L' },
    'Sodio_mg_L': { max: 200, unit: 'mg/L' },
    'Arsenico_ug_L': { max: 10, unit: 'µg/L' },
    'Bicarbonato_mg_L': { max: null, unit: 'mg/L' },
    'Cloro_residuo_mg_L': { min: 0.2, max: null, unit: 'mg/L' },
    'Fluoruri_mg_L': { max: 1.5, unit: 'mg/L' },
    'Nitrato_mg_L': { max: 50, unit: 'mg/L' },
    'Nitrito_mg_L': { max: 0.5, unit: 'mg/L' },
    'Manganese_ug_L': { max: 50, unit: 'µg/L' }
};

// Parameter display names in Italian
const PARAMETER_NAMES = {
    'pH': 'pH',
    'Residuo_fisso_mg_L': 'Residuo fisso',
    'Durezza_totale_F': 'Durezza totale',
    'Conducibilita_uS_cm': 'Conducibilità elettrica',
    'Calcio_mg_L': 'Calcio',
    'Magnesio_mg_L': 'Magnesio',
    'Ammonio_mg_L': 'Ammonio',
    'Cloruro_mg_L': 'Cloruro',
    'Solfato_mg_L': 'Solfato',
    'Potassio_mg_L': 'Potassio',
    'Sodio_mg_L': 'Sodio',
    'Arsenico_ug_L': 'Arsenico',
    'Bicarbonato_mg_L': 'Bicarbonato',
    'Cloro_residuo_mg_L': 'Cloro residuo libero',
    'Fluoruri_mg_L': 'Fluoruri',
    'Nitrato_mg_L': 'Nitrato',
    'Nitrito_mg_L': 'Nitrito',
    'Manganese_ug_L': 'Manganese'
};

// CSV data embedded in JavaScript (converted from acque_bergamo.csv)
const WATER_QUALITY_CSV_DATA = `Comune,pH,Residuo_fisso_mg_L,Durezza_totale_F,Conducibilita_uS_cm,Calcio_mg_L,Magnesio_mg_L,Ammonio_mg_L,Cloruro_mg_L,Solfato_mg_L,Potassio_mg_L,Sodio_mg_L,Arsenico_ug_L,Bicarbonato_mg_L,Cloro_residuo_mg_L,Fluoruri_mg_L,Nitrato_mg_L,Nitrito_mg_L,Manganese_ug_L
adrara san martino,7.8,285,24,401,86,4,< 0.1,6,15,1.4,4.4,< 1,272,0.20,0.11,13,< 0.05,5
adrara san rocco,8.1,270,23,395,83,4,< 0.1,2,6,< 0.5,1.8,< 1,275,0.18,0.10,16,< 0.05,< 5
albano santalessandro,8.0,226,20,334,68,3,< 0.1,3,10,1.1,2.5,< 1,244,0.13,0.08,7,< 0.05,< 5
albino,7.7,265,22,383,79,3,< 0.1,5,12,1.2,4.1,< 1,253,0.20,0.07,12,< 0.05,< 5
algua,7.8,278,23,394,82,4,< 0.1,3,11,1.4,2.7,< 1,276,0.17,0.11,14,< 0.05,< 5
alm,7.9,156,14,235,49,2,< 0.1,2,4,0.8,1.2,< 1,147,0.20,0.08,6,< 0.05,< 5
almenno san bartolomeo,8.0,242,21,351,75,3,< 0.1,4,11,1.1,2.9,< 1,263,0.15,0.06,6,< 0.05,< 5
almenno san salvatore,8.0,237,20,346,72,3,< 0.1,4,11,1.1,3.3,< 1,253,0.17,0.07,7,< 0.05,< 5
alzano lombardo,7.9,223,19,326,68,2,< 0.1,5,8,1.0,4.0,< 1,231,0.16,0.08,9,< 0.05,< 5
ambivere,7.9,243,21,358,76,3,< 0.1,5,11,1.1,3.8,< 1,264,0.15,0.08,8,< 0.05,< 5
antegnate,7.9,282,24,406,90,4,< 0.1,5,17,1.4,4.2,< 1,302,0.18,0.08,11,< 0.05,< 5
arcene,7.8,239,20,349,72,3,< 0.1,4,11,1.1,3.5,< 1,257,0.16,0.07,8,< 0.05,< 5
ardesio,7.8,204,17,299,60,3,< 0.1,3,7,1.0,2.5,< 1,207,0.18,0.08,8,< 0.05,< 5
aviatico,7.8,278,23,394,82,4,< 0.1,3,11,1.4,2.7,< 1,276,0.17,0.11,14,< 0.05,< 5
azzano san paolo,7.9,228,19,334,67,3,< 0.1,4,9,1.1,3.6,< 1,242,0.16,0.07,7,< 0.05,< 5
azzone,7.9,156,14,235,49,2,< 0.1,2,4,0.8,1.2,< 1,147,0.20,0.08,6,< 0.05,< 5
bagnatica,7.9,225,18,325,52,14,< 0.1,5,4,1.1,4.2,< 1,243,0.16,0.07,10,< 0.05,< 5
barbata,7.9,280,24,405,89,4,< 0.1,5,16,1.4,4.1,< 1,301,0.17,0.08,10,< 0.05,< 5
barzana,8.0,242,21,351,75,3,< 0.1,4,11,1.1,2.9,< 1,263,0.15,0.06,6,< 0.05,< 5
bedulita,7.9,156,14,235,49,2,< 0.1,2,4,0.8,1.2,< 1,147,0.20,0.08,6,< 0.05,< 5
berbenno,7.9,204,17,299,60,3,< 0.1,3,7,1.0,2.5,< 1,207,0.18,0.08,8,< 0.05,< 5
bergamo,7.9,225,18,325,52,14,< 0.1,5,4,1.1,4.2,< 1,243,0.16,0.07,10,< 0.05,< 5
berzo san fermo,7.9,156,14,235,49,2,< 0.1,2,4,0.8,1.2,< 1,147,0.20,0.08,6,< 0.05,< 5
bianzano,7.8,278,23,394,82,4,< 0.1,3,11,1.4,2.7,< 1,276,0.17,0.11,14,< 0.05,< 5
blello,7.9,156,14,235,49,2,< 0.1,2,4,0.8,1.2,< 1,147,0.20,0.08,6,< 0.05,< 5
bolgare,7.9,228,19,334,67,3,< 0.1,4,9,1.1,3.6,< 1,242,0.16,0.07,7,< 0.05,< 5
boltiere,7.9,243,21,358,76,3,< 0.1,5,11,1.1,3.8,< 1,264,0.15,0.08,8,< 0.05,< 5
bonate sopra,8.0,242,21,351,75,3,< 0.1,4,11,1.1,2.9,< 1,263,0.15,0.06,6,< 0.05,< 5
bonate sotto,8.0,237,20,346,72,3,< 0.1,4,11,1.1,3.3,< 1,253,0.17,0.07,7,< 0.05,< 5
borgo di terzo,7.9,223,19,326,68,2,< 0.1,5,8,1.0,4.0,< 1,231,0.16,0.08,9,< 0.05,< 5
bossico,7.8,278,23,394,82,4,< 0.1,3,11,1.4,2.7,< 1,276,0.17,0.11,14,< 0.05,< 5
bottanuco,7.9,243,21,358,76,3,< 0.1,5,11,1.1,3.8,< 1,264,0.15,0.08,8,< 0.05,< 5
bracca,8.0,242,21,351,75,3,< 0.1,4,11,1.1,2.9,< 1,263,0.15,0.06,6,< 0.05,< 5
brembate,7.9,243,21,358,76,3,< 0.1,5,11,1.1,3.8,< 1,264,0.15,0.08,8,< 0.05,< 5
brembate di sopra,8.0,242,21,351,75,3,< 0.1,4,11,1.1,2.9,< 1,263,0.15,0.06,6,< 0.05,< 5
brumano,7.9,156,14,235,49,2,< 0.1,2,4,0.8,1.2,< 1,147,0.20,0.08,6,< 0.05,< 5
brusaporto,7.9,228,19,334,67,3,< 0.1,4,9,1.1,3.6,< 1,242,0.16,0.07,7,< 0.05,< 5
calcinate,7.9,223,19,326,68,2,< 0.1,5,8,1.0,4.0,< 1,231,0.16,0.08,9,< 0.05,< 5
calcio,7.9,280,24,405,89,4,< 0.1,5,16,1.4,4.1,< 1,301,0.17,0.08,10,< 0.05,< 5
calusco dadda,7.9,243,21,358,76,3,< 0.1,5,11,1.1,3.8,< 1,264,0.15,0.08,8,< 0.05,< 5
capizzone,8.0,242,21,351,75,3,< 0.1,4,11,1.1,2.9,< 1,263,0.15,0.06,6,< 0.05,< 5
capriate san gervasio,7.9,243,21,358,76,3,< 0.1,5,11,1.1,3.8,< 1,264,0.15,0.08,8,< 0.05,< 5
caprino bergamasco,7.9,228,19,334,67,3,< 0.1,4,9,1.1,3.6,< 1,242,0.16,0.07,7,< 0.05,< 5
carobbio degli angeli,7.9,223,19,326,68,2,< 0.1,5,8,1.0,4.0,< 1,231,0.16,0.08,9,< 0.05,< 5
carona,7.9,156,14,235,49,2,< 0.1,2,4,0.8,1.2,< 1,147,0.20,0.08,6,< 0.05,< 5
carvico,7.9,243,21,358,76,3,< 0.1,5,11,1.1,3.8,< 1,264,0.15,0.08,8,< 0.05,< 5
casazza,8.1,161,14,225,50,2,< 0.1,< 2,5,0.6,1.3,< 1,263,< 0.10,0.17,8,< 0.05,< 5
casnigo,7.7,265,22,383,79,3,< 0.1,5,12,1.2,4.1,< 1,253,0.20,0.07,12,< 0.05,< 5
cassiglio,7.9,156,14,235,49,2,< 0.1,2,4,0.8,1.2,< 1,147,0.20,0.08,6,< 0.05,< 5
castelli calepio,7.9,223,19,326,68,2,< 0.1,5,8,1.0,4.0,< 1,231,0.16,0.08,9,< 0.05,< 5
castel rozzone,7.9,280,24,405,89,4,< 0.1,5,16,1.4,4.1,< 1,301,0.17,0.08,10,< 0.05,< 5
castione della presolana,7.8,204,17,299,60,3,< 0.1,3,7,1.0,2.5,< 1,207,0.18,0.08,8,< 0.05,< 5
castro,7.8,278,23,394,82,4,< 0.1,3,11,1.4,2.7,< 1,276,0.17,0.11,14,< 0.05,< 5
cavernago,7.9,223,19,326,68,2,< 0.1,5,8,1.0,4.0,< 1,231,0.16,0.08,9,< 0.05,< 5
cazzano santandrea,7.9,280,24,405,89,4,< 0.1,5,16,1.4,4.1,< 1,301,0.17,0.08,10,< 0.05,< 5
cenate sopra,7.9,225,18,325,52,14,< 0.1,5,4,1.1,4.2,< 1,243,0.16,0.07,10,< 0.05,< 5
cenate sotto,7.9,225,18,325,52,14,< 0.1,5,4,1.1,4.2,< 1,243,0.16,0.07,10,< 0.05,< 5
cene,7.7,265,22,383,79,3,< 0.1,5,12,1.2,4.1,< 1,253,0.20,0.07,12,< 0.05,< 5
cerete,7.8,204,17,299,60,3,< 0.1,3,7,1.0,2.5,< 1,207,0.18,0.08,8,< 0.05,< 5
chignolo disola,7.9,243,21,358,76,3,< 0.1,5,11,1.1,3.8,< 1,264,0.15,0.08,8,< 0.05,< 5
chiuduno,7.9,223,19,326,68,2,< 0.1,5,8,1.0,4.0,< 1,231,0.16,0.08,9,< 0.05,< 5
cisano bergamasco,7.9,228,19,334,67,3,< 0.1,4,9,1.1,3.6,< 1,242,0.16,0.07,7,< 0.05,< 5
ciserano,7.9,243,21,358,76,3,< 0.1,5,11,1.1,3.8,< 1,264,0.15,0.08,8,< 0.05,< 5
cividate al piano,7.9,282,24,406,90,4,< 0.1,5,17,1.4,4.2,< 1,302,0.18,0.08,11,< 0.05,< 5
clusone,7.8,204,17,299,60,3,< 0.1,3,7,1.0,2.5,< 1,207,0.18,0.08,8,< 0.05,< 5
colere,7.9,156,14,235,49,2,< 0.1,2,4,0.8,1.2,< 1,147,0.20,0.08,6,< 0.05,< 5
cologno al serio,7.9,282,24,406,90,4,< 0.1,5,17,1.4,4.2,< 1,302,0.18,0.08,11,< 0.05,< 5
colzate,7.7,265,22,383,79,3,< 0.1,5,12,1.2,4.1,< 1,253,0.20,0.07,12,< 0.05,< 5
comun nuovo,7.9,282,24,406,90,4,< 0.1,5,17,1.4,4.2,< 1,302,0.18,0.08,11,< 0.05,< 5
cornalba,7.9,156,14,235,49,2,< 0.1,2,4,0.8,1.2,< 1,147,0.20,0.08,6,< 0.05,< 5
corna imagna,7.9,156,14,235,49,2,< 0.1,2,4,0.8,1.2,< 1,147,0.20,0.08,6,< 0.05,< 5
cortenuova,7.9,282,24,406,90,4,< 0.1,5,17,1.4,4.2,< 1,302,0.18,0.08,11,< 0.05,< 5
costa di mezzate,7.9,228,19,334,67,3,< 0.1,4,9,1.1,3.6,< 1,242,0.16,0.07,7,< 0.05,< 5
costa serina,7.9,156,14,235,49,2,< 0.1,2,4,0.8,1.2,< 1,147,0.20,0.08,6,< 0.05,< 5
costa valle imagna,7.9,156,14,235,49,2,< 0.1,2,4,0.8,1.2,< 1,147,0.20,0.08,6,< 0.05,< 5
costa volpino,8.1,161,14,225,50,2,< 0.1,< 2,5,0.6,1.3,< 1,263,< 0.10,0.17,8,< 0.05,< 5
covo,7.9,282,24,406,90,4,< 0.1,5,17,1.4,4.2,< 1,302,0.18,0.08,11,< 0.05,< 5
credaro,7.9,223,19,326,68,2,< 0.1,5,8,1.0,4.0,< 1,231,0.16,0.08,9,< 0.05,< 5
curno,7.9,243,21,358,76,3,< 0.1,5,11,1.1,3.8,< 1,264,0.15,0.08,8,< 0.05,< 5
dalmine,7.9,243,21,358,76,3,< 0.1,5,11,1.1,3.8,< 1,264,0.15,0.08,8,< 0.05,< 5
dossena,7.9,156,14,235,49,2,< 0.1,2,4,0.8,1.2,< 1,147,0.20,0.08,6,< 0.05,< 5
endine gaiano,8.1,161,14,225,50,2,< 0.1,< 2,5,0.6,1.3,< 1,263,< 0.10,0.17,8,< 0.05,< 5
entratico,7.9,223,19,326,68,2,< 0.1,5,8,1.0,4.0,< 1,231,0.16,0.08,9,< 0.05,< 5
fara olivana con sola,7.9,282,24,406,90,4,< 0.1,5,17,1.4,4.2,< 1,302,0.18,0.08,11,< 0.05,< 5
filago,7.9,243,21,358,76,3,< 0.1,5,11,1.1,3.8,< 1,264,0.15,0.08,8,< 0.05,< 5
fino del monte,7.8,204,17,299,60,3,< 0.1,3,7,1.0,2.5,< 1,207,0.18,0.08,8,< 0.05,< 5
fiorano al serio,7.9,282,24,406,90,4,< 0.1,5,17,1.4,4.2,< 1,302,0.18,0.08,11,< 0.05,< 5
fontanella,7.9,282,24,406,90,4,< 0.1,5,17,1.4,4.2,< 1,302,0.18,0.08,11,< 0.05,< 5
fonteno,7.8,278,23,394,82,4,< 0.1,3,11,1.4,2.7,< 1,276,0.17,0.11,14,< 0.05,< 5
foppolo,7.9,156,14,235,49,2,< 0.1,2,4,0.8,1.2,< 1,147,0.20,0.08,6,< 0.05,< 5
foresto sparso,7.9,223,19,326,68,2,< 0.1,5,8,1.0,4.0,< 1,231,0.16,0.08,9,< 0.05,< 5
fuipiano valle imagna,8.0,191,17,283,63,2,< 0.1,3,7,0.9,2.3,< 1,290,0.13,0.16,16,< 0.05,< 5
gandellino,7.8,204,17,299,60,3,< 0.1,3,7,1.0,2.5,< 1,207,0.18,0.08,8,< 0.05,< 5
gandino,7.7,265,22,383,79,3,< 0.1,5,12,1.2,4.1,< 1,253,0.20,0.07,12,< 0.05,< 5
gandosso,7.9,228,19,334,67,3,< 0.1,4,9,1.1,3.6,< 1,242,0.16,0.07,7,< 0.05,< 5
gaverina terme,8.1,161,14,225,50,2,< 0.1,< 2,5,0.6,1.3,< 1,263,< 0.10,0.17,8,< 0.05,< 5
gazzaniga,7.7,265,22,383,79,3,< 0.1,5,12,1.2,4.1,< 1,253,0.20,0.07,12,< 0.05,< 5
ghisalba,7.9,282,24,406,90,4,< 0.1,5,17,1.4,4.2,< 1,302,0.18,0.08,11,< 0.05,< 5
gorlago,7.9,223,19,326,68,2,< 0.1,5,8,1.0,4.0,< 1,231,0.16,0.08,9,< 0.05,< 5
gorle,7.9,228,19,334,67,3,< 0.1,4,9,1.1,3.6,< 1,242,0.16,0.07,7,< 0.05,< 5
gorno,7.8,204,17,299,60,3,< 0.1,3,7,1.0,2.5,< 1,207,0.18,0.08,8,< 0.05,< 5
grassobbio,7.9,228,19,334,67,3,< 0.1,4,9,1.1,3.6,< 1,242,0.16,0.07,7,< 0.05,< 5
gromo,7.8,204,17,299,60,3,< 0.1,3,7,1.0,2.5,< 1,207,0.18,0.08,8,< 0.05,< 5
grone,7.7,265,22,383,79,3,< 0.1,5,12,1.2,4.1,< 1,253,0.20,0.07,12,< 0.05,< 5
grumello del monte,7.9,223,19,326,68,2,< 0.1,5,8,1.0,4.0,< 1,231,0.16,0.08,9,< 0.05,< 5
isso,7.9,282,24,406,90,4,< 0.1,5,17,1.4,4.2,< 1,302,0.18,0.08,11,< 0.05,< 5
lallio,7.9,243,21,358,76,3,< 0.1,5,11,1.1,3.8,< 1,264,0.15,0.08,8,< 0.05,< 5
leffe,7.7,265,22,383,79,3,< 0.1,5,12,1.2,4.1,< 1,253,0.20,0.07,12,< 0.05,< 5
lenna,7.9,156,14,235,49,2,< 0.1,2,4,0.8,1.2,< 1,147,0.20,0.08,6,< 0.05,< 5
levate,7.9,243,21,358,76,3,< 0.1,5,11,1.1,3.8,< 1,264,0.15,0.08,8,< 0.05,< 5
locatello,7.9,156,14,235,49,2,< 0.1,2,4,0.8,1.2,< 1,147,0.20,0.08,6,< 0.05,< 5
lovere,8.1,161,14,225,50,2,< 0.1,< 2,5,0.6,1.3,< 1,263,< 0.10,0.17,8,< 0.05,< 5
lurano,7.9,282,24,406,90,4,< 0.1,5,17,1.4,4.2,< 1,302,0.18,0.08,11,< 0.05,< 5
luzzana,7.7,265,22,383,79,3,< 0.1,5,12,1.2,4.1,< 1,253,0.20,0.07,12,< 0.05,< 5
madone,7.9,223,19,326,68,2,< 0.1,5,8,1.0,4.0,< 1,231,0.16,0.08,9,< 0.05,< 5
mapello,8.0,242,21,351,75,3,< 0.1,4,11,1.1,2.9,< 1,263,0.15,0.06,6,< 0.05,< 5
martinengo,7.9,282,24,406,90,4,< 0.1,5,17,1.4,4.2,< 1,302,0.18,0.08,11,< 0.05,< 5
medolago,7.9,223,19,326,68,2,< 0.1,5,8,1.0,4.0,< 1,231,0.16,0.08,9,< 0.05,< 5
moio de calvi,7.9,156,14,235,49,2,< 0.1,2,4,0.8,1.2,< 1,147,0.20,0.08,6,< 0.05,< 5
monasterolo del castello,8.1,161,14,225,50,2,< 0.1,< 2,5,0.6,1.3,< 1,263,< 0.10,0.17,8,< 0.05,< 5
montello,7.9,223,19,326,68,2,< 0.1,5,8,1.0,4.0,< 1,231,0.16,0.08,9,< 0.05,< 5
mornico al serio,7.9,282,24,406,90,4,< 0.1,5,17,1.4,4.2,< 1,302,0.18,0.08,11,< 0.05,< 5
mozzo,8.0,242,21,351,75,3,< 0.1,4,11,1.1,2.9,< 1,263,0.15,0.06,6,< 0.05,< 5
nembro,7.7,265,22,383,79,3,< 0.1,5,12,1.2,4.1,< 1,253,0.20,0.07,12,< 0.05,< 5
oltressenda alta,7.8,204,17,299,60,3,< 0.1,3,7,1.0,2.5,< 1,207,0.18,0.08,8,< 0.05,< 5
oltre il colle,7.9,156,14,235,49,2,< 0.1,2,4,0.8,1.2,< 1,147,0.20,0.08,6,< 0.05,< 5
oneta,7.9,156,14,235,49,2,< 0.1,2,4,0.8,1.2,< 1,147,0.20,0.08,6,< 0.05,< 5
onore,7.8,278,23,394,82,4,< 0.1,3,11,1.4,2.7,< 1,276,0.17,0.11,14,< 0.05,< 5
orio al serio,7.9,282,24,406,90,4,< 0.1,5,17,1.4,4.2,< 1,302,0.18,0.08,11,< 0.05,< 5
ornica,7.9,156,14,235,49,2,< 0.1,2,4,0.8,1.2,< 1,147,0.20,0.08,6,< 0.05,< 5
osio sotto,7.9,243,21,358,76,3,< 0.1,5,11,1.1,3.8,< 1,264,0.15,0.08,8,< 0.05,< 5
paladina,8.0,242,21,351,75,3,< 0.1,4,11,1.1,2.9,< 1,263,0.15,0.06,6,< 0.05,< 5
palazzago,8.0,242,21,351,75,3,< 0.1,4,11,1.1,2.9,< 1,263,0.15,0.06,6,< 0.05,< 5
palosco,7.9,282,24,406,90,4,< 0.1,5,17,1.4,4.2,< 1,302,0.18,0.08,11,< 0.05,< 5
parre,7.8,204,17,299,60,3,< 0.1,3,7,1.0,2.5,< 1,207,0.18,0.08,8,< 0.05,< 5
parzanica,8.1,161,14,225,50,2,< 0.1,< 2,5,0.6,1.3,< 1,263,< 0.10,0.17,8,< 0.05,< 5
pedrengo,7.7,265,22,383,79,3,< 0.1,5,12,1.2,4.1,< 1,253,0.20,0.07,12,< 0.05,< 5
peia,7.8,204,17,299,60,3,< 0.1,3,7,1.0,2.5,< 1,207,0.18,0.08,8,< 0.05,< 5
pianico,8.1,161,14,225,50,2,< 0.1,< 2,5,0.6,1.3,< 1,263,< 0.10,0.17,8,< 0.05,< 5
piario,7.8,204,17,299,60,3,< 0.1,3,7,1.0,2.5,< 1,207,0.18,0.08,8,< 0.05,< 5
piazza brembana,7.9,156,14,235,49,2,< 0.1,2,4,0.8,1.2,< 1,147,0.20,0.08,6,< 0.05,< 5
piazzolo,7.8,204,17,299,60,3,< 0.1,3,7,1.0,2.5,< 1,207,0.18,0.08,8,< 0.05,< 5
pognano,7.9,282,24,406,90,4,< 0.1,5,17,1.4,4.2,< 1,302,0.18,0.08,11,< 0.05,< 5
ponteranica,8.0,242,21,351,75,3,< 0.1,4,11,1.1,2.9,< 1,263,0.15,0.06,6,< 0.05,< 5
ponte nossa,7.8,204,17,299,60,3,< 0.1,3,7,1.0,2.5,< 1,207,0.18,0.08,8,< 0.05,< 5
ponte san pietro,8.0,242,21,351,75,3,< 0.1,4,11,1.1,2.9,< 1,263,0.15,0.06,6,< 0.05,< 5
pontida,8.0,242,21,351,75,3,< 0.1,4,11,1.1,2.9,< 1,263,0.15,0.06,6,< 0.05,< 5
pradalunga,7.7,265,22,383,79,3,< 0.1,5,12,1.2,4.1,< 1,253,0.20,0.07,12,< 0.05,< 5
predore,8.1,161,14,225,50,2,< 0.1,< 2,5,0.6,1.3,< 1,263,< 0.10,0.17,8,< 0.05,< 5
premolo,8.1,161,14,225,50,2,< 0.1,< 2,5,0.6,1.3,< 1,263,< 0.10,0.17,8,< 0.05,< 5
presezzo,8.0,242,21,351,75,3,< 0.1,4,11,1.1,2.9,< 1,263,0.15,0.06,6,< 0.05,< 5
pumenengo,7.9,282,24,406,90,4,< 0.1,5,17,1.4,4.2,< 1,302,0.18,0.08,11,< 0.05,< 5
ranica,7.7,265,22,383,79,3,< 0.1,5,12,1.2,4.1,< 1,253,0.20,0.07,12,< 0.05,< 5
ranzanico,8.1,161,14,225,50,2,< 0.1,< 2,5,0.6,1.3,< 1,263,< 0.10,0.17,8,< 0.05,< 5
riva di solto,8.1,161,14,225,50,2,< 0.1,< 2,5,0.6,1.3,< 1,263,< 0.10,0.17,8,< 0.05,< 5
rogno,8.1,161,14,225,50,2,< 0.1,< 2,5,0.6,1.3,< 1,263,< 0.10,0.17,8,< 0.05,< 5
romano di lombardia,7.9,282,24,406,90,4,< 0.1,5,17,1.4,4.2,< 1,302,0.18,0.08,11,< 0.05,< 5
roncola,8.0,242,21,351,75,3,< 0.1,4,11,1.1,2.9,< 1,263,0.15,0.06,6,< 0.05,< 5
rovetta,7.8,204,17,299,60,3,< 0.1,3,7,1.0,2.5,< 1,207,0.18,0.08,8,< 0.05,< 5
santomobono terme,7.9,156,14,235,49,2,< 0.1,2,4,0.8,1.2,< 1,147,0.20,0.08,6,< 0.05,< 5
san giovanni bianco,7.9,156,14,235,49,2,< 0.1,2,4,0.8,1.2,< 1,147,0.20,0.08,6,< 0.05,< 5
san paolo dargon,7.9,156,14,235,49,2,< 0.1,2,4,0.8,1.2,< 1,147,0.20,0.08,6,< 0.05,< 5
san pellegrino terme,8.0,242,21,351,75,3,< 0.1,4,11,1.1,2.9,< 1,263,0.15,0.06,6,< 0.05,< 5
sarnico,8.1,161,14,225,50,2,< 0.1,< 2,5,0.6,1.3,< 1,263,< 0.10,0.17,8,< 0.05,< 5
scanzorosciate,7.7,265,22,383,79,3,< 0.1,5,12,1.2,4.1,< 1,253,0.20,0.07,12,< 0.05,< 5
schilpario,7.8,204,17,299,60,3,< 0.1,3,7,1.0,2.5,< 1,207,0.18,0.08,8,< 0.05,< 5
sedrina,8.0,242,21,351,75,3,< 0.1,4,11,1.1,2.9,< 1,263,0.15,0.06,6,< 0.05,< 5
selvino,8.0,242,21,351,75,3,< 0.1,4,11,1.1,2.9,< 1,263,0.15,0.06,6,< 0.05,< 5
seriate,7.9,228,19,334,67,3,< 0.1,4,9,1.1,3.6,< 1,242,0.16,0.07,7,< 0.05,< 5
serina,7.9,156,14,235,49,2,< 0.1,2,4,0.8,1.2,< 1,147,0.20,0.08,6,< 0.05,< 5
solto collina,7.9,225,20,322,42,23,< 0.1,< 2,4,1.0,1.0,< 1,229,0.18,0.08,6,< 0.05,< 5
solza,7.9,243,21,358,76,3,< 0.1,5,11,1.1,3.8,< 1,264,0.15,0.08,8,< 0.05,< 5
songavazzo,7.8,204,17,299,60,3,< 0.1,3,7,1.0,2.5,< 1,207,0.18,0.08,8,< 0.05,< 5
sorisole,8.0,242,21,351,75,3,< 0.1,4,11,1.1,2.9,< 1,263,0.15,0.06,6,< 0.05,< 5
sotto il monte giovanni xxiii,8.0,242,21,351,75,3,< 0.1,4,11,1.1,2.9,< 1,263,0.15,0.06,6,< 0.05,< 5
sovere,8.1,161,14,225,50,2,< 0.1,< 2,5,0.6,1.3,< 1,263,< 0.10,0.17,8,< 0.05,< 5
spinone al lago,8.1,161,14,225,50,2,< 0.1,< 2,5,0.6,1.3,< 1,263,< 0.10,0.17,8,< 0.05,< 5
spirano,7.9,282,24,406,90,4,< 0.1,5,17,1.4,4.2,< 1,302,0.18,0.08,11,< 0.05,< 5
stezzano,7.9,243,21,358,76,3,< 0.1,5,11,1.1,3.8,< 1,264,0.15,0.08,8,< 0.05,< 5
strozza,8.0,242,21,351,75,3,< 0.1,4,11,1.1,2.9,< 1,263,0.15,0.06,6,< 0.05,< 5
suisio,7.9,243,21,358,76,3,< 0.1,5,11,1.1,3.8,< 1,264,0.15,0.08,8,< 0.05,< 5
taleggio,7.9,156,14,235,49,2,< 0.1,2,4,0.8,1.2,< 1,147,0.20,0.08,6,< 0.05,< 5
tavernola bergamasca,8.1,161,14,225,50,2,< 0.1,< 2,5,0.6,1.3,< 1,263,< 0.10,0.17,8,< 0.05,< 5
telgate,7.9,223,19,326,68,2,< 0.1,5,8,1.0,4.0,< 1,231,0.16,0.08,9,< 0.05,< 5
terno disola,7.9,243,21,358,76,3,< 0.1,5,11,1.1,3.8,< 1,264,0.15,0.08,8,< 0.05,< 5
torre boldone,7.9,228,19,334,67,3,< 0.1,4,9,1.1,3.6,< 1,242,0.16,0.07,7,< 0.05,< 5
torre de busi,8.0,242,21,351,75,3,< 0.1,4,11,1.1,2.9,< 1,263,0.15,0.06,6,< 0.05,< 5
torre de roveri,7.9,243,21,358,76,3,< 0.1,5,11,1.1,3.8,< 1,264,0.15,0.08,8,< 0.05,< 5
torre pallavicina,7.9,282,24,406,90,4,< 0.1,5,17,1.4,4.2,< 1,302,0.18,0.08,11,< 0.05,< 5
trescore balneario,8.0,226,19,334,55,14,< 0.1,< 2,7,1.0,1.0,< 1,224,0.11,0.08,8,< 0.05,< 5
treviolo,7.9,228,19,334,67,3,< 0.1,4,9,1.1,3.6,< 1,242,0.16,0.07,7,< 0.05,< 5
ubiale clanezzo,8.0,242,21,351,75,3,< 0.1,4,11,1.1,2.9,< 1,263,0.15,0.06,6,< 0.05,< 5
urgnano,7.9,282,24,406,90,4,< 0.1,5,17,1.4,4.2,< 1,302,0.18,0.08,11,< 0.05,< 5
valbondione,7.8,204,17,299,60,3,< 0.1,3,7,1.0,2.5,< 1,207,0.18,0.08,8,< 0.05,< 5
valbrembo,8.0,242,21,351,75,3,< 0.1,4,11,1.1,2.9,< 1,263,0.15,0.06,6,< 0.05,< 5
valgoglio,7.8,204,17,299,60,3,< 0.1,3,7,1.0,2.5,< 1,207,0.18,0.08,8,< 0.05,< 5
valleve,7.9,156,14,235,49,2,< 0.1,2,4,0.8,1.2,< 1,147,0.20,0.08,6,< 0.05,< 5
valnegra,7.9,156,14,235,49,2,< 0.1,2,4,0.8,1.2,< 1,147,0.20,0.08,6,< 0.05,< 5
valtorta,7.9,156,14,235,49,2,< 0.1,2,4,0.8,1.2,< 1,147,0.20,0.08,6,< 0.05,< 5
val brembilla,8.0,242,21,351,75,3,< 0.1,4,11,1.1,2.9,< 1,263,0.15,0.06,6,< 0.05,< 5
verdellino,7.9,282,24,406,90,4,< 0.1,5,17,1.4,4.2,< 1,302,0.18,0.08,11,< 0.05,< 5
verdello,7.9,282,24,406,90,4,< 0.1,5,17,1.4,4.2,< 1,302,0.18,0.08,11,< 0.05,< 5
vertova,7.7,265,22,383,79,3,< 0.1,5,12,1.2,4.1,< 1,253,0.20,0.07,12,< 0.05,< 5
viadanica,7.9,282,24,406,90,4,< 0.1,5,17,1.4,4.2,< 1,302,0.18,0.08,11,< 0.05,< 5
vigano san martino,7.9,282,24,406,90,4,< 0.1,5,17,1.4,4.2,< 1,302,0.18,0.08,11,< 0.05,< 5
vigolo,8.0,242,21,351,75,3,< 0.1,4,11,1.1,2.9,< 1,263,0.15,0.06,6,< 0.05,< 5
villa dadda,7.9,243,21,358,76,3,< 0.1,5,11,1.1,3.8,< 1,264,0.15,0.08,8,< 0.05,< 5
villa dalm,7.9,243,21,358,76,3,< 0.1,5,11,1.1,3.8,< 1,264,0.15,0.08,8,< 0.05,< 5
villa di serio,7.7,265,22,383,79,3,< 0.1,5,12,1.2,4.1,< 1,253,0.20,0.07,12,< 0.05,< 5
villa dogna,7.9,282,24,406,90,4,< 0.1,5,17,1.4,4.2,< 1,302,0.18,0.08,11,< 0.05,< 5
villongo,8.1,161,14,225,50,2,< 0.1,< 2,5,0.6,1.3,< 1,263,< 0.10,0.17,8,< 0.05,< 5
vilminore di scalve,7.8,204,17,299,60,3,< 0.1,3,7,1.0,2.5,< 1,207,0.18,0.08,8,< 0.05,< 5
zandobbio,7.9,262,23,370,53,22,< 0.1,2,8,1.3,1.3,< 1,270,0.18,0.08,8,< 0.05,< 5
zanica,7.9,228,19,334,67,3,< 0.1,4,9,1.1,3.6,< 1,242,0.16,0.07,7,< 0.05,< 5
zogno,8.0,242,21,351,75,3,< 0.1,4,11,1.1,2.9,< 1,263,0.15,0.06,6,< 0.05,< 5`;

// Parse CSV data into JavaScript objects
function parseCSV(csvText) {
    const lines = csvText.trim().split('\n');
    const headers = lines[0].split(',');
    const municipalities = [];

    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',');
        const municipality = {};

        headers.forEach((header, index) => {
            municipality[header] = values[index];
        });

        municipalities.push(municipality);
    }

    return municipalities;
}

// Global data storage
let MUNICIPALITIES_DATA = [];

// Helper functions
const WaterQualityHelper = {
    // Initialize data
    init: function() {
        MUNICIPALITIES_DATA = parseCSV(WATER_QUALITY_CSV_DATA);
        console.log(`Loaded ${MUNICIPALITIES_DATA.length} municipalities`);
    },

    // Get all municipalities
    getAllMunicipalities: function() {
        return MUNICIPALITIES_DATA;
    },

    // Search municipalities by name
    searchMunicipalities: function(searchTerm) {
        if (!searchTerm || searchTerm.length < 2) {
            return MUNICIPALITIES_DATA;
        }

        const term = searchTerm.toLowerCase().trim();
        return MUNICIPALITIES_DATA.filter(municipality =>
            municipality.Comune.toLowerCase().includes(term)
        );
    },

    // Get municipality by exact name
    getMunicipalityByName: function(name) {
        return MUNICIPALITIES_DATA.find(municipality =>
            municipality.Comune.toLowerCase() === name.toLowerCase()
        );
    },

    // Get all parameter names
    getAllParameters: function() {
        if (MUNICIPALITIES_DATA.length === 0) return [];
        return Object.keys(MUNICIPALITIES_DATA[0]).filter(key => key !== 'Comune');
    },

    // Parse value (handle < and > symbols)
    parseValue: function(value) {
        if (typeof value !== 'string') return value;

        const cleanValue = value.trim();

        // Handle < values
        if (cleanValue.startsWith('< ')) {
            return {
                value: parseFloat(cleanValue.substring(2)),
                operator: '<',
                original: cleanValue
            };
        }

        // Handle > values
        if (cleanValue.startsWith('> ')) {
            return {
                value: parseFloat(cleanValue.substring(2)),
                operator: '>',
                original: cleanValue
            };
        }

        // Handle numeric values with decimal comma
        if (cleanValue.includes(',')) {
            const numericValue = parseFloat(cleanValue.replace(',', '.'));
            if (!isNaN(numericValue)) {
                return {
                    value: numericValue,
                    operator: '=',
                    original: cleanValue
                };
            }
        }

        // Handle regular numeric values
        const numericValue = parseFloat(cleanValue);
        if (!isNaN(numericValue)) {
            return {
                value: numericValue,
                operator: '=',
                original: cleanValue
            };
        }

        return {
            value: cleanValue,
            operator: '=',
            original: cleanValue
        };
    },

    // Check if value exceeds limits
    checkLimits: function(parameter, value) {
        const parsedValue = this.parseValue(value);
        const limits = WATER_QUALITY_LIMITS[parameter];

        if (!limits) return { withinLimits: true, message: 'Nessun limite definito' };

        const numericValue = parsedValue.value;

        // Skip limit checking for non-numeric values
        if (isNaN(numericValue)) {
            return { withinLimits: true, message: 'Valore non numerico' };
        }

        let violations = [];

        if (limits.min !== undefined && limits.min !== null && numericValue < limits.min) {
            violations.push(`Sotto il minimo (${limits.min})`);
        }

        if (limits.max !== undefined && limits.max !== null && numericValue > limits.max) {
            violations.push(`Sopra il massimo (${limits.max})`);
        }

        return {
            withinLimits: violations.length === 0,
            violations: violations,
            message: violations.length > 0 ? violations.join(', ') : 'Entro i limiti'
        };
    },

    // Format value for display
    formatValue: function(value) {
        const parsed = this.parseValue(value);
        return parsed.original;
    },

    // Get parameter display name
    getParameterDisplayName: function(parameter) {
        return PARAMETER_NAMES[parameter] || parameter;
    },

    // Get parameter unit
    getParameterUnit: function(parameter) {
        const limits = WATER_QUALITY_LIMITS[parameter];
        return limits ? limits.unit : '';
    },

    // Get parameter limits for display
    getParameterLimits: function(parameter) {
        const limits = WATER_QUALITY_LIMITS[parameter];
        if (!limits) return 'N/A';

        let limitText = '';
        if (limits.min !== undefined && limits.min !== null) {
            limitText += `Min: ${limits.min}`;
        }
        if (limits.max !== undefined && limits.max !== null) {
            if (limitText) limitText += ', ';
            limitText += `Max: ${limits.max}`;
        }

        if (limitText && limits.unit) {
            limitText += ` ${limits.unit}`;
        }

        return limitText || 'N/A';
    },

    // Get statistics for a parameter
    getParameterStats: function(parameter) {
        const values = MUNICIPALITIES_DATA
            .map(m => this.parseValue(m[parameter]))
            .filter(v => !isNaN(v.value))
            .map(v => v.value);

        if (values.length === 0) return null;

        values.sort((a, b) => a - b);

        return {
            count: values.length,
            min: values[0],
            max: values[values.length - 1],
            median: values[Math.floor(values.length / 2)],
            average: values.reduce((sum, val) => sum + val, 0) / values.length
        };
    }
};

// UI Management
const WaterQualityUI = {
    // Show all municipalities
    showAllMunicipalities: function() {
        this.displayMunicipalities(WaterQualityHelper.getAllMunicipalities());
    },

    // Perform search
    performSearch: function() {
        const searchInput = document.getElementById('municipality-search');
        const searchTerm = searchInput ? searchInput.value : '';
        const results = WaterQualityHelper.searchMunicipalities(searchTerm);
        this.displayMunicipalities(results);
    },

    // Display municipalities
    displayMunicipalities: function(municipalities) {
        const resultsContainer = document.getElementById('search-results');
        if (!resultsContainer) return;

        if (municipalities.length === 0) {
            resultsContainer.innerHTML = `
                <div class="no-results">
                    <p>Nessun comune trovato. Prova con un termine di ricerca diverso.</p>
                </div>
            `;
            return;
        }

        let html = `<div class="stats-summary">
            <h4>📊 Risultati della Ricerca</h4>
            <p><strong>Comuni trovati:</strong> ${municipalities.length}</p>
            <p><strong>Database completo:</strong> ${WaterQualityHelper.getAllMunicipalities().length} comuni della provincia di Bergamo</p>
        </div>`;

        municipalities.forEach((municipality, index) => {
            const sectionId = `municipality-${index}`;
            const municipalityName = municipality.Comune.split(' ').map(word =>
                word.charAt(0).toUpperCase() + word.slice(1)
            ).join(' ');

            html += `
                <div class="municipality-section">
                    <div class="municipality-header" onclick="WaterQualityUI.toggleMunicipality('${sectionId}')">
                        <h4>${municipalityName}</h4>
                        <span class="toggle-icon" id="icon-${sectionId}">▼</span>
                    </div>
                    <div class="municipality-content" id="${sectionId}" style="display: none;">
                        ${this.generateParameterTable(municipality)}
                    </div>
                </div>
            `;
        });

        resultsContainer.innerHTML = html;
    },

    // Generate parameter table for a municipality
    generateParameterTable: function(municipality) {
        const parameters = WaterQualityHelper.getAllParameters();

        let tableHtml = `
            <table class="parameter-table">
                <thead>
                    <tr>
                        <th>Parametro</th>
                        <th>Valore</th>
                        <th>Unità</th>
                        <th>Limiti</th>
                        <th>Stato</th>
                    </tr>
                </thead>
                <tbody>
        `;

        parameters.forEach(param => {
            const value = municipality[param];
            const displayName = WaterQualityHelper.getParameterDisplayName(param);
            const unit = WaterQualityHelper.getParameterUnit(param);
            const limits = WaterQualityHelper.getParameterLimits(param);
            const formattedValue = WaterQualityHelper.formatValue(value);
            const limitCheck = WaterQualityHelper.checkLimits(param, value);

            const rowClass = limitCheck.withinLimits ? '' : 'above-limit';
            const statusIcon = limitCheck.withinLimits ? '✅' : '⚠️';

            tableHtml += `
                <tr class="${rowClass}">
                    <td>${displayName}</td>
                    <td>${formattedValue}</td>
                    <td>${unit}</td>
                    <td>${limits}</td>
                    <td>${statusIcon} ${limitCheck.message}</td>
                </tr>
            `;
        });

        tableHtml += `
                </tbody>
            </table>
        `;

        return tableHtml;
    },

    // Compare parameter across municipalities
    compareParameter: function() {
        const selectElement = document.getElementById('parameter-select');
        if (!selectElement || !selectElement.value) {
            alert('Seleziona un parametro da confrontare');
            return;
        }

        const parameter = selectElement.value;
        const municipalities = WaterQualityHelper.getAllMunicipalities();
        const displayName = WaterQualityHelper.getParameterDisplayName(parameter);
        const unit = WaterQualityHelper.getParameterUnit(parameter);
        const stats = WaterQualityHelper.getParameterStats(parameter);

        // Sort municipalities by parameter value
        const sortedMunicipalities = municipalities
            .map(m => ({
                ...m,
                parsedValue: WaterQualityHelper.parseValue(m[parameter])
            }))
            .filter(m => !isNaN(m.parsedValue.value))
            .sort((a, b) => b.parsedValue.value - a.parsedValue.value);

        let html = `
            <div class="stats-summary">
                <h4>📊 Confronto: ${displayName}</h4>
                ${stats ? `
                    <p><strong>Valore minimo:</strong> ${stats.min} ${unit}</p>
                    <p><strong>Valore massimo:</strong> ${stats.max} ${unit}</p>
                    <p><strong>Media:</strong> ${stats.average.toFixed(2)} ${unit}</p>
                    <p><strong>Mediana:</strong> ${stats.median} ${unit}</p>
                    <p><strong>Comuni analizzati:</strong> ${stats.count}</p>
                ` : '<p>Dati non disponibili per le statistiche</p>'}
            </div>
        `;

        if (sortedMunicipalities.length > 0) {
            html += `
                <table class="parameter-table">
                    <thead>
                        <tr>
                            <th>Posizione</th>
                            <th>Comune</th>
                            <th>Valore</th>
                            <th>Stato</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            sortedMunicipalities.forEach((municipality, index) => {
                const municipalityName = municipality.Comune.split(' ').map(word =>
                    word.charAt(0).toUpperCase() + word.slice(1)
                ).join(' ');

                const formattedValue = WaterQualityHelper.formatValue(municipality[parameter]);
                const limitCheck = WaterQualityHelper.checkLimits(parameter, municipality[parameter]);
                const rowClass = limitCheck.withinLimits ? '' : 'above-limit';
                const statusIcon = limitCheck.withinLimits ? '✅' : '⚠️';

                html += `
                    <tr class="${rowClass}">
                        <td>${index + 1}</td>
                        <td>${municipalityName}</td>
                        <td>${formattedValue} ${unit}</td>
                        <td>${statusIcon} ${limitCheck.message}</td>
                    </tr>
                `;
            });

            html += `
                    </tbody>
                </table>
            `;
        }

        const resultsContainer = document.getElementById('comparison-results');
        if (resultsContainer) {
            resultsContainer.innerHTML = html;
        }
    },

    // Toggle municipality section
    toggleMunicipality: function(sectionId) {
        const content = document.getElementById(sectionId);
        const icon = document.getElementById('icon-' + sectionId);

        if (content && icon) {
            if (content.style.display === 'none' || content.style.display === '') {
                content.style.display = 'block';
                icon.textContent = '▲';
                icon.style.transform = 'rotate(180deg)';
                content.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            } else {
                content.style.display = 'none';
                icon.textContent = '▼';
                icon.style.transform = 'rotate(0deg)';
            }
        }
    }
};

// Initialize data when script loads
WaterQualityHelper.init();

// Export for global use
if (typeof window !== 'undefined') {
    window.WaterQualityHelper = WaterQualityHelper;
    window.WaterQualityUI = WaterQualityUI;
}