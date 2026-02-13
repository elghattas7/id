/**
 * ID_IDOSR_Bouarfa - Modern Student Management System
 * Logic moved from index.html to app.js
 */

// Initialize Theme immediately
(function () {
    const isDarkMode = localStorage.getItem('theme') !== 'light';
    if (!isDarkMode) {
        document.body.classList.add('light-mode');
    }
})();

const SUPABASE_URL = 'https://ugnirkolwlqblcnamthe.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVnbmlya29sd2xxYmxjbmFtdGhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzMDM1NzgsImV4cCI6MjA4MDg3OTU3OH0.oaCSXl5bPSqn-m1IsQiWcji7YzJBkeaTaHfq6uoHV-U';

// Initialize Supabase
// Initialize Supabase
if (window.supabase && window.supabase.createClient) {
    window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    window.supabase = window.supabaseClient;
} else {
    console.error("Supabase library not loaded!");
}

// Global State
let currentUser = null;
let data = {
    stagiaires: [],
    modules: [],
    notes: {},
    absences: [],
    cours: [],
    examens: [],
    datesExamens: [],
    vacances: [],
    loginStats: []
};

// --- Supabase Helpers ---
async function uploadFile(file) {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `${fileName}`;

    const { data, error } = await supabase.storage
        .from('documents')
        .upload(filePath, file);

    if (error) {
        console.error('Upload Error:', error);
        alert('Erreur lors de l\'upload du fichier: ' + error.message);
        return null;
    }

    const { data: { publicUrl } } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath);

    return publicUrl;
}

// --- Data Loading ---
async function loadData() {
    console.log('Chargement des données...');

    try {
        const [
            { data: stagiaires },
            { data: modules },
            { data: notes },
            { data: absences },
            { data: cours },
            { data: examens },
            { data: calendrier },
            { data: vacances },
            { data: loginStats }
        ] = await Promise.all([
            supabase.from('stagiaires').select('*').limit(1000),
            supabase.from('modules').select('*').limit(1000),
            supabase.from('notes').select('*').limit(5000),
            supabase.from('absences').select('*').limit(5000),
            supabase.from('cours').select('*').limit(500),
            supabase.from('examens').select('*').limit(500),
            supabase.from('calendrier_examens').select('*').limit(500),
            supabase.from('vacances').select('*').limit(100),
            supabase.from('login_stats').select('*').limit(1000)
        ]);

        // Mapping Stagiaires
        data.stagiaires = stagiaires || [];

        // Mapping Modules (snake_case -> camelCase)
        data.modules = (modules || []).map(m => ({
            id: m.id,
            nom: m.nom,
            nbControles: m.nb_controles,
            annee: m.annee,
            type: m.type,
            coefficient: m.coefficient
        }));

        // Mapping Notes (Reconstruction de l'objet)
        data.notes = {};
        (notes || []).forEach(n => {
            const key = `${n.module_id}_${n.stagiaire_id}`;
            data.notes[key] = {
                controles: n.controles || [],
                efm: n.efm
            };
        });

        // Mapping Absences
        data.absences = (absences || []).map(a => ({
            id: a.id,
            stagiaireId: a.stagiaire_id,
            date: a.date,
            horaire: a.horaire
        }));

        // Mapping Cours
        data.cours = (cours || []).map(c => ({
            id: c.id,
            titre: c.titre,
            moduleId: c.module_id,
            annee: c.annee,
            description: c.description,
            fichierNom: c.fichier_nom,
            fichierTaille: c.fichier_taille,
            fichierData: c.fichier_url,
            dateAjout: new Date(c.created_at).toLocaleDateString()
        }));

        // Mapping Examens
        data.examens = (examens || []).map(e => ({
            id: e.id,
            titre: e.titre,
            moduleId: e.module_id,
            type: e.type,
            annee: e.annee,
            description: e.description,
            fichierNom: e.fichier_nom,
            fichierTaille: e.fichier_taille,
            fichierData: e.fichier_url,
            dateAjout: new Date(e.created_at).toLocaleDateString()
        }));

        // Mapping Calendrier
        data.datesExamens = (calendrier || []).map(d => ({
            id: d.id,
            titre: d.titre,
            // module_id and type checked as non-existent in schema
            date: d.date,
            horaire: `${d.heure_debut} → ${d.heure_fin}`.replace(/:00/g, ''),
            annee: d.annee,
            heureDebut: d.heure_debut,
            heureFin: d.heure_fin
        }));

        // Mapping Vacances
        data.vacances = (vacances || []).map(v => ({
            id: v.id,
            titre: v.titre,
            description: v.description,
            fichierNom: 'Document',
            fichierTaille: '-',
            fichierData: v.fichier_url,
            datePublication: new Date(v.date_publication).toLocaleDateString()
        }));

        // Mapping Login Stats
        data.loginStats = (loginStats || []).map(ls => ({
            id: ls.id,
            stagiaireId: ls.stagiaire_id,
            loginCount: ls.login_count || 0,
            lastLoginDate: ls.last_login_date
        }));

        console.log('Données chargées:', data);

        // Update Stats on Dashboard if Formateur
        if (currentUser && currentUser.role === 'formateur') {
            updateDashboardStats();
            loadFormateurData();
        } else if (currentUser) {
            loadStagiaireData();
        }

    } catch (error) {
        console.error("Erreur lors du chargement des données:", error);
        alert("Erreur de connexion: " + (error.message || JSON.stringify(error)));
    }
}

function updateDashboardStats() {
    document.getElementById('totalStagiaires').textContent = data.stagiaires.length;
    document.getElementById('totalModules').textContent = data.modules.length;
    document.getElementById('totalCours').textContent = data.cours.length;
    document.getElementById('totalExamens').textContent = data.examens.length;
}

// --- Auth Functions ---
async function login() {
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const errorMsg = document.getElementById('loginError');

    const username = usernameInput.value;
    const password = passwordInput.value;

    errorMsg.style.display = 'none';

    try {
        // 1. Check Formateur
        const { data: formateurData, error: formateurError } = await supabase
            .from('formateurs')
            .select('*')
            .eq('username', username)
            .eq('password', password)
            .single();

        if (formateurData) {
            currentUser = { ...formateurData, type: 'formateur', role: 'formateur' };
            await loadData();
            showDashboard('formateur');
            return;
        }

        // 2. Check Stagiaire
        const { data: stagiaireData, error: stagiaireError } = await supabase
            .from('stagiaires')
            .select('*')
            .eq('cin', username)
            .eq('password', password)
            .single();

        if (stagiaireData) {
            currentUser = { ...stagiaireData, type: 'stagiaire', role: 'stagiaire' };

            // Update login statistics
            const now = new Date().toISOString();
            const existingStat = data.loginStats.find(ls => ls.stagiaireId === stagiaireData.id);

            if (existingStat) {
                // Update existing record
                const { error: updateError } = await supabase
                    .from('login_stats')
                    .update({
                        login_count: existingStat.loginCount + 1,
                        last_login_date: now
                    })
                    .eq('stagiaire_id', stagiaireData.id);

                if (updateError) console.error('Error updating login stats:', updateError);
            } else {
                // Create new record
                const { error: insertError } = await supabase
                    .from('login_stats')
                    .insert({
                        stagiaire_id: stagiaireData.id,
                        login_count: 1,
                        last_login_date: now
                    });

                if (insertError) console.error('Error inserting login stats:', insertError);
            }

            await loadData();
            showDashboard('stagiaire');
            return;
        }

        // Failed
        errorMsg.textContent = 'Identifiant ou mot de passe incorrect';
        errorMsg.style.display = 'block';

    } catch (e) {
        console.error("Login exception:", e);
        errorMsg.textContent = 'Erreur de connexion';
        errorMsg.style.display = 'block';
    }
}

function togglePasswordVisibility() {
    const passwordInput = document.getElementById('password');
    const toggleIcon = document.getElementById('togglePasswordBtn');

    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        toggleIcon.classList.remove('fa-eye');
        toggleIcon.classList.add('fa-eye-slash');
    } else {
        passwordInput.type = 'password';
        toggleIcon.classList.remove('fa-eye-slash');
        toggleIcon.classList.add('fa-eye');
    }
}

function logout() {
    currentUser = null;
    document.getElementById('loginPage').style.display = 'block';
    document.getElementById('formateurDashboard').style.display = 'none';
    document.getElementById('stagiaireDashboard').style.display = 'none';

    // Clear inputs
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
}

function showDashboard(type) {
    console.log('=== SHOWING DASHBOARD:', type, '===');

    const loginPage = document.getElementById('loginPage');
    const formateurDash = document.getElementById('formateurDashboard');
    const stagiaireDash = document.getElementById('stagiaireDashboard');

    console.log('Login page element:', loginPage);
    console.log('Formateur dashboard element:', formateurDash);
    console.log('Stagiaire dashboard element:', stagiaireDash);

    loginPage.style.display = 'none';
    console.log('Login page hidden');

    if (type === 'formateur') {
        formateurDash.style.display = 'block';
        console.log('Formateur dashboard display set to block');
        console.log('Formateur dashboard computed display:', window.getComputedStyle(formateurDash).display);
        console.log('Formateur dashboard visibility:', window.getComputedStyle(formateurDash).visibility);

        // document.getElementById('formateurName').textContent = currentUser.nom; // Removed: Hide formateur name
        chargerModulesPublication(); // Initialize module list
        switchTab('vue-ensemble');
    } else {
        stagiaireDash.style.display = 'block';
        console.log('Stagiaire dashboard display set to block');
        console.log('Stagiaire dashboard computed display:', window.getComputedStyle(stagiaireDash).display);

        const stagiaireNameParams = document.getElementById('stagiaireName');
        if (stagiaireNameParams) stagiaireNameParams.textContent = `${currentUser.nom} ${currentUser.prenom}`;
        const stagiaireCINParams = document.getElementById('stagiaireCIN');
        if (stagiaireCINParams) stagiaireCINParams.textContent = currentUser.cin;
        switchTab('mes-notes');
    }

    console.log('=== DASHBOARD SHOWN ===');
}

// --- UI Logic ---
function switchTab(tabName) {
    console.log('=== Switching to tab:', tabName, '===');

    // Hide all contents by removing active class
    const contents = document.querySelectorAll('.tab-content');
    console.log('Found', contents.length, 'tab-content elements');
    contents.forEach(el => {
        el.classList.remove('active');
    });

    // Deactivate all nav items
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));

    // Show selected content by adding active class
    const targetContent = document.getElementById(tabName);
    console.log('Target element:', targetContent);

    if (targetContent) {
        console.log('Adding active class to:', tabName);
        targetContent.classList.add('active');

        // Force a reflow to ensure CSS is applied
        void targetContent.offsetHeight;

        const computedStyle = window.getComputedStyle(targetContent);
        console.log('Element computed display:', computedStyle.display);
        console.log('Element has active class:', targetContent.classList.contains('active'));
    } else {
        console.error('❌ Target tab content not found:', tabName);
    }

    // Activate nav button
    // Exact match using Regex to avoid "examens" matching "dates-examens"
    const activeBtns = document.querySelectorAll(`.nav-item`);
    activeBtns.forEach(btn => {
        const onclickVal = btn.getAttribute('onclick');
        // Matches switchTab('tabName') exactly, allowing for different quote styles
        const regex = new RegExp(`switchTab\\(['"]${tabName}['"]\\)`);
        if (regex.test(onclickVal)) {
            btn.classList.add('active');
        }
    });
}


// --- Hijri Date Helper ---
function getHijriYear() {
    try {
        const date = new Date();
        const hijriDate = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { year: 'numeric' }).format(date);
        return hijriDate.split(' ')[0];
    } catch (e) {
        return "1446";
    }
}

// --- Formateur Features ---

// Import Stagiaires
function importStagiaires() {
    const file = document.getElementById('excelFile').files[0];
    const annee = document.getElementById('importAnnee').value;

    if (!file) {
        alert('Veuillez sélectionner un fichier Excel');
        return;
    }

    const reader = new FileReader();
    reader.onload = async function (e) {
        const data_xlsx = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data_xlsx, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet);

        let compteur = 0;
        let erreurs = 0;
        const hijriYear = getHijriYear();

        for (const row of jsonData) {
            const cin = row.CIN || row.cin;
            const nom = row.Nom || row.nom;
            const prenom = row.Prénom || row.Prenom || row.prenom;

            if (!cin || !nom || !prenom) continue;

            const defaultPassword = `${cin}@${hijriYear}`;

            const { error } = await supabase.from('stagiaires').insert({
                cin: cin.toString(),
                nom: nom,
                prenom: prenom,
                annee: annee,
                password: defaultPassword
            });

            if (!error) {
                compteur++;
            } else {
                console.error('Erreur import:', cin, error.message);
                erreurs++;
            }
        }

        await loadData();
        alert(`${compteur} stagiaire(s) de ${annee} importé(s)! (${erreurs} erreurs)`);
        afficherStagiaires(); // Refresh list
    };
    reader.readAsArrayBuffer(file);
}

function afficherStagiaires() {
    const tbody = document.querySelector('#stagiairesList tbody');
    if (!tbody) return;

    const filter = document.getElementById('filterAnnee')?.value || '';
    tbody.innerHTML = '';

    const stagiairesFiltr = filter ? data.stagiaires.filter(s => s.annee === filter) : data.stagiaires;
    stagiairesFiltr.sort((a, b) => a.nom.localeCompare(b.nom));

    stagiairesFiltr.forEach(s => {
        tbody.innerHTML += `
            <tr>
                <td><strong>${s.cin}</strong></td>
                <td>${s.nom}</td>
                <td>${s.prenom}</td>
                <td><span class="badge badge-primary">${s.annee}</span></td>
                <td>
                    <button class="btn btn-small btn-delete" onclick="supprimerStagiaire('${s.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    });
}

async function supprimerStagiaire(id) {
    if (confirm('Supprimer ce stagiaire?')) {
        const { error } = await supabase.from('stagiaires').delete().eq('id', id);
        if (error) {
            alert('Erreur: ' + error.message);
        } else {
            await loadData();
            afficherStagiaires();
            updateDashboardStats();
        }
    }
}

// Formateur Data Loader Helper
function loadFormateurData() {
    afficherStagiaires();
    // Add other refresher functions here if needed
}

// Modules
async function ajouterModule() {
    const nom = document.getElementById('moduleName').value;
    const nbControles = parseInt(document.getElementById('nbControles').value);
    const annee = document.getElementById('moduleAnnee').value;
    const type = document.getElementById('moduleType').value;
    const coefficient = parseFloat(document.getElementById('moduleCoefficient').value);

    if (!nom) {
        alert('Veuillez entrer un nom de module');
        return;
    }

    const { error } = await supabase.from('modules').insert({
        nom: nom,
        nb_controles: nbControles,
        annee: annee,
        type: type,
        coefficient: coefficient
    });

    if (error) {
        alert('Erreur: ' + error.message);
    } else {
        document.getElementById('moduleName').value = '';
        await loadData();
        alert('Module ajouté!');
        updateDashboardStats();
    }
}

function chargerModulesParAnnee() {
    const annee = document.getElementById('notesAnnee').value;
    const moduleSelect = document.getElementById('moduleSelect');

    moduleSelect.innerHTML = '<option value="">-- Choisir un module --</option>';

    if (annee) {
        const modulesFiltr = data.modules.filter(m => m.annee === annee);
        modulesFiltr.forEach(m => {
            moduleSelect.innerHTML += `<option value="${m.id}">${m.nom} (${m.type}, Coef: ${m.coefficient})</option>`;
        });
    }
}

function chargerNotesModule() {
    const moduleId = document.getElementById('moduleSelect').value;
    const annee = document.getElementById('notesAnnee').value;

    if (!moduleId || !annee) return;

    const module = data.modules.find(m => m.id === moduleId);
    const stagiairesFiltres = data.stagiaires.filter(s => s.annee === annee);
    const section = document.getElementById('notesSection');

    let html = '<div class="table-responsive"><table><thead><tr><th>Stagiaire</th>';
    for (let i = 1; i <= module.nbControles; i++) {
        html += `<th>CC ${i}</th>`;
    }
    html += '<th>EFM (/40)</th><th>Moyenne</th></tr></thead><tbody>';

    stagiairesFiltres.forEach(s => {
        const key = `${moduleId}_${s.id}`;
        const notes = data.notes[key] || { controles: [], efm: '' };

        html += `<tr><td>${s.nom} ${s.prenom}</td>`;
        for (let i = 0; i < module.nbControles; i++) {
            const val = notes.controles[i] !== undefined ? notes.controles[i] : '';
            html += `<td><input type="number" min="0" max="20" step="0.5" value="${val}" 
                     onchange="sauvegarderNote('${moduleId}', '${s.id}', 'controle', ${i}, this.value)" 
                     style="width:60px; padding: 5px; border-radius: 5px; color: #28a745; font-weight: bold;"></td>`;
        }
        const efmVal = notes.efm !== undefined && notes.efm !== null ? notes.efm : '';
        html += `<td><input type="number" min="0" max="40" step="0.5" value="${efmVal}" 
                 onchange="sauvegarderNote('${moduleId}', '${s.id}', 'efm', 0, this.value)" 
                 style="width:60px; padding: 5px; border-radius: 5px; color: #ffc107; font-weight: bold;"></td>`;

        const moyenne = calculerMoyenne(notes, module.nbControles);
        html += `<td id="moyenne_${moduleId}_${s.id}"><strong style="color: #ff4b4b;">${moyenne}</strong></td></tr>`;
    });

    html += '</tbody></table></div>';
    section.innerHTML = html;
}

async function sauvegarderNote(moduleId, stagiaireId, type, index, value) {
    const key = `${moduleId}_${stagiaireId}`;
    const currentNotes = data.notes[key] || { controles: [], efm: null };

    let newControles = [...(currentNotes.controles || [])];
    let newEfm = currentNotes.efm;

    const valParsed = value === '' ? null : parseFloat(value);

    if (type === 'controle') {
        newControles[index] = valParsed;
    } else {
        newEfm = valParsed;
    }

    if (!data.notes[key]) data.notes[key] = {};
    data.notes[key].controles = newControles;
    data.notes[key].efm = newEfm;

    const module = data.modules.find(m => m.id === moduleId);
    const moyenne = calculerMoyenne(data.notes[key], module.nbControles);
    const moyenneCell = document.getElementById(`moyenne_${moduleId}_${stagiaireId}`);
    if (moyenneCell) {
        moyenneCell.innerHTML = `<strong>${moyenne}</strong>`;
    }

    const { error } = await supabase.from('notes').upsert({
        module_id: moduleId,
        stagiaire_id: stagiaireId,
        controles: newControles,
        efm: newEfm
    }, { onConflict: 'module_id,stagiaire_id' });

    if (error) console.error('Erreur save note:', error);
}

function calculerMoyenne(notes, nbControles) {
    if (notes.efm === null || notes.efm === undefined) return '-';

    if (nbControles === 0) {
        return (notes.efm / 2).toFixed(2);
    }

    let sommeControles = 0;
    let nbControlesValides = 0;

    for (let i = 0; i < nbControles; i++) {
        if (notes.controles[i] !== null && notes.controles[i] !== undefined) {
            sommeControles += notes.controles[i];
            nbControlesValides++;
        }
    }

    if (nbControlesValides === 0) return '-';

    const moyenneControles = sommeControles / nbControlesValides;
    const moyenne = (moyenneControles + notes.efm) / 3;
    return moyenne.toFixed(2);
}

// Absences
function chargerStagiairesParAnnee() {
    const annee = document.getElementById('absenceAnnee').value;
    const select = document.getElementById('absenceStagiaire');
    select.innerHTML = '<option value="">-- Choisir un stagiaire --</option>';
    if (annee) {
        const stagiairesFiltres = data.stagiaires.filter(s => s.annee === annee);
        stagiairesFiltres.forEach(s => {
            select.innerHTML += `<option value="${s.id}">${s.nom} ${s.prenom}</option>`;
        });
    }
}

async function ajouterAbsence() {
    const stagiaireId = document.getElementById('absenceStagiaire').value;
    const date = document.getElementById('absenceDate').value;
    const horaire = document.getElementById('absenceHoraire').value;

    if (!stagiaireId || !date) {
        alert('Veuillez remplir tous les champs');
        return;
    }

    const { error } = await supabase.from('absences').insert({
        stagiaire_id: stagiaireId,
        date: date,
        horaire: horaire
    });

    if (error) {
        alert('Erreur: ' + error.message);
    } else {
        alert('Absence enregistrée');
        await loadData();
        afficherAbsences(); // Refresh list if on that tab
    }
}

function afficherAbsences() {
    const tbody = document.querySelector('#absencesTable tbody');
    if (!tbody) return;

    const filter = document.getElementById('filterAbsenceAnnee')?.value || '';
    tbody.innerHTML = '';

    const absencesParStagiaire = {};

    data.stagiaires.forEach(s => {
        if (!filter || s.annee === filter) {
            absencesParStagiaire[s.id] = {
                nom: `${s.nom} ${s.prenom}`,
                annee: s.annee,
                total: 0,
                details: []
            };
        }
    });

    data.absences.forEach(a => {
        if (absencesParStagiaire[a.stagiaireId]) {
            absencesParStagiaire[a.stagiaireId].total++;
            absencesParStagiaire[a.stagiaireId].details.push(a);
        }
    });

    Object.entries(absencesParStagiaire).forEach(([id, info]) => {
        if (info.total > 0) {
            tbody.innerHTML += `
                <tr>
                    <td>${info.nom}</td>
                    <td><span class="badge badge-primary">${info.annee}</span></td>
                    <td>${info.total}</td>
                    <td><button class="btn btn-small" onclick="voirDetailsAbsences('${id}')">Voir</button></td>
                </tr>
            `;
        }
    });
}

function voirDetailsAbsences(stagiaireId) {
    const absences = data.absences.filter(a => a.stagiaireId === stagiaireId);
    const stagiaire = data.stagiaires.find(s => s.id === stagiaireId);
    let msg = `Absences de ${stagiaire.nom} ${stagiaire.prenom}:\n\n`;
    absences.forEach(a => {
        msg += `${a.date} - Horaire: ${a.horaire}\n`;
    });
    alert(msg);
}

// Cours
async function ajouterCours() {
    const titre = document.getElementById('coursTitle').value;
    const moduleId = document.getElementById('coursModule').value;
    const fileInput = document.getElementById('coursFile');
    const annee = document.getElementById('coursAnnee').value;

    if (!titre || !moduleId || !fileInput.files[0]) {
        alert('Veuillez remplir tous les champs et sélectionner un fichier');
        return;
    }

    const file = fileInput.files[0];
    const url = await uploadFile(file);

    if (!url) return;

    const { error } = await supabase.from('cours').insert({
        titre: titre,
        module_id: moduleId,
        annee: annee,
        fichier_url: url,
        fichier_nom: file.name,
        fichier_taille: formatFileSize(file.size)
    });

    if (error) {
        alert('Erreur: ' + error.message);
    } else {
        alert('Cours publié!');
        await loadData();
        afficherCours();
    }
}

function afficherCours() {
    const tbody = document.querySelector('#coursList tbody');
    if (!tbody) return;

    const filter = document.getElementById('filterCoursAnnee')?.value || '';
    tbody.innerHTML = '';

    const coursFiltr = filter ? data.cours.filter(c => c.annee === filter) : data.cours;

    coursFiltr.forEach(c => {
        const module = data.modules.find(m => m.id === c.moduleId);
        tbody.innerHTML += `
            <tr>
                <td>${c.titre}</td>
                <td>${module ? module.nom : 'Inconnu'}</td>
                <td><span class="badge badge-primary">${c.annee}</span></td>
                <td><a href="${c.fichierData}" target="_blank" style="color:var(--accent)">Télécharger</a></td>
                <td>${c.fichierTaille}</td>
                <td><button class="btn btn-small btn-delete" onclick="supprimerCours('${c.id}')"><i class="fas fa-trash"></i></button></td>
            </tr>
        `;
    });
}

async function supprimerCours(id) {
    if (confirm('Supprimer ce cours?')) {
        const { error } = await supabase.from('cours').delete().eq('id', id);
        if (error) {
            alert('Erreur: ' + error.message);
        } else {
            await loadData();
            afficherCours();
        }
    }
}

// Helpers
function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Vacances
function afficherVacances() {
    const list = document.getElementById('vacancesList');
    if (!list) return;
    list.innerHTML = '';

    if (data.vacances.length === 0) {
        list.innerHTML = '<li>Aucune vacance enregistrée.</li>';
        return;
    }

    data.vacances.forEach(v => {
        // Assume fichierData is an image URL
        const imageHtml = v.fichierData
            ? `<div style="margin-top:10px;"><img src="${v.fichierData}" alt="Image Vacances" style="max-width: 100%; border-radius: 5px; max-height: 200px; object-fit: cover;"></div>`
            : '';

        const downloadBtn = v.fichierData
            ? `<a href="${v.fichierData}" download class="btn-small" style="margin-top: 10px; display: inline-block;">
                <i class="fas fa-download"></i> Télécharger l'image
               </a>`
            : '';

        list.innerHTML += `
            <li style="margin-bottom: 20px; padding: 15px; background: rgba(255,255,255,0.05); border-radius: 8px;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <strong>${v.titre}</strong>
                    <span style="font-size:0.8rem; opacity:0.7;">${v.datePublication}</span>
                </div>
                <p style="margin: 5px 0;">${v.description || ''}</p>
                ${imageHtml}
                ${downloadBtn}
            </li>
        `;
    });
}

function ajouterExamenDate() {
    const titre = document.getElementById('examenDateTitre').value;
    const date = document.getElementById('examenDateDate').value;
    const heureDebut = document.getElementById('examenDateHeureDebut').value;
    const heureFin = document.getElementById('examenDateHeureFin').value;
    const annee = document.getElementById('examenDateAnnee').value;

    if (!titre || !date || !heureDebut || !heureFin || !annee) {
        alert("Veuillez remplir tous les champs !");
        return;
    }

    const newExamen = {
        titre, date, heureDebut, heureFin, annee,
        id: Date.now()
    };

    // Insert into Supabase
    // Note: Schema confirmed by user: id, titre, date, heure_debut, heure_fin, annee, created_at
    supabase.from('calendrier_examens').insert([{
        titre: titre,
        date: date,
        heure_debut: heureDebut,
        heure_fin: heureFin,
        annee: annee
    }]).then(({ error }) => {
        if (error) {
            console.error('Error inserting date:', error);
            alert("Erreur lors de l'enregistrement: " + error.message);
        } else {
            console.log('Date enregistrée avec succès');
            data.datesExamens.push(newExamen);
            afficherCalendrier(); // Refresh formateur list

            if (document.getElementById('calendrierListStagiaire')) {
                afficherCalendrier('calendrierListStagiaire');
            }
            alert("Date d'examen ajoutée et enregistrée !");
        }
    });

    // Reset form
    document.getElementById('examenDateTitre').value = '';
    document.getElementById('examenDateDate').value = '';
    document.getElementById('examenDateHeureDebut').value = '';
    document.getElementById('examenDateHeureFin').value = '';
    // Reset
    document.getElementById('examenTitre').value = '';
    fileInput.value = '';
}

function ajouterExamen() {
    const annee = document.getElementById('examenAnnee').value;
    const titre = document.getElementById('examenTitre').value;
    const fileInput = document.getElementById('examenFile');

    if (!titre || !fileInput.files[0]) {
        alert("Veuillez remplir tous les champs !");
        return;
    }

    const file = fileInput.files[0];

        // Use FileReader to convert to Base64 (No Bucket required)
    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onload = function () {
        const base64Data = reader.result;

        // Insert into Supabase 'examens' table
        supabase.from('examens').insert([{
            titre: titre,
            annee: annee,
            fichier_nom: file.name,
            fichier_url: base64Data // Storing the full Data URI
        }]).then(({ error }) => {
            if (error) {
                console.error('Error inserting sujet:', error);
                if (error.message && error.message.includes('payload')) {
                    alert("Erreur: Le fichier est trop volumineux pour être enregistré sans bucket.");
                } else {
                    alert("Erreur base de données: " + error.message);
                }
            } else {
                // Update local data
                const newExamen = {
                    id: Date.now(), // Temporary ID until refresh
                    titre: titre,
                    annee: annee,
                    fichierData: base64Data,
                    fichierNom: file.name,
                    dateAjout: new Date().toLocaleDateString()
                };

                if (!data.examens) data.examens = [];
                data.examens.push(newExamen);

                afficherSujets();
                if (document.getElementById('examensListStagiaire')) {
                    afficherSujets('examensListStagiaire');
                }

                // Reset form
                document.getElementById('examenTitre').value = '';
                fileInput.value = '';

                alert("Sujet d'examen ajouté et enregistré !");
            }
        });
    };

    reader.onerror = function (error) {
        console.error('Error reading file:', error);
        alert("Erreur lors de la lecture du fichier.");
    };
}

// Formateur Data Loader Helper
function loadFormateurData() {
    afficherStagiaires();
    afficherVacances();
    afficherStatistiques();
    afficherCalendrier();
    afficherSujets();
    loadSettings();
}

// Statistiques
function afficherStatistiques() {
    const tbody = document.querySelector('#statistiquesTable tbody');
    if (!tbody) return;

    const filter = document.getElementById('filterStatsAnnee')?.value || '';
    tbody.innerHTML = '';

    // Filter stagiaires by year if selected
    const stagiairesFiltr = filter ? data.stagiaires.filter(s => s.annee === filter) : data.stagiaires;
    stagiairesFiltr.sort((a, b) => a.nom.localeCompare(b.nom));

    if (stagiairesFiltr.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6">Aucun stagiaire trouvé.</td></tr>';
        return;
    }

    stagiairesFiltr.forEach(s => {
        const stat = data.loginStats.find(ls => ls.stagiaireId === s.id);
        const loginCount = stat ? stat.loginCount : 0;
        const lastLogin = stat && stat.lastLoginDate
            ? new Date(stat.lastLoginDate).toLocaleString('fr-FR', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            })
            : 'Jamais connecté';

        tbody.innerHTML += `
            <tr>
                <td><strong>${s.cin}</strong></td>
                <td>${s.nom}</td>
                <td>${s.prenom}</td>
                <td><span class="badge badge-primary">${s.annee}</span></td>
                <td><strong>${loginCount}</strong></td>
                <td>${lastLogin}</td>
            </tr>
        `;
    });
}

// ... (Rest of existing functions)

// Stagiaire Features
// Stagiaire Data Loader
function loadStagiaireData() {
    console.log('--- loadStagiaireData STARTED ---');
    console.log('Current User:', currentUser);

    try {
        // Fill stagiaire specific tables
        // Notes
        console.log('Loading notes table...');
        const notesTable = document.querySelector('#mesNotesTable tbody');
        if (notesTable) {
            notesTable.innerHTML = '';
            data.modules.filter(m => m.annee === currentUser.annee).forEach(m => {
                const key = `${m.id}_${currentUser.id}`;
                const notes = data.notes[key];
                if (notes) {
                    const moyenne = calculerMoyenne(notes, m.nbControles);
                    // Vertical formatting for controls with /20
                    const controlesVertical = notes.controles.map((c, index) => `<div><span style="color: white; font-weight: bold;">Contrôle ${index + 1}:</span> <span style="color: #28a745; font-weight: bold;">${c}/20</span></div>`).join('');

                    notesTable.innerHTML += `
                    <tr>
                        <td>${m.nom}</td>
                        <td>${m.type}</td>
                        <td>${m.coefficient}</td>
                        <td>${controlesVertical}</td>
                        <td style="color: #ffc107; font-weight: bold;">${notes.efm ? notes.efm + '/40' : '-'}</td>
                        <td><strong style="color: #ff4b4b;">${moyenne}/20</strong></td>
                    </tr>
                `;
                }
            });
        }

        // Absences
        const absencesTable = document.querySelector('#mesAbsencesTable tbody');
        if (absencesTable) {
            absencesTable.innerHTML = '';
            const mesAbsences = data.absences.filter(a => a.stagiaireId === currentUser.id);

            if (mesAbsences.length === 0) {
                absencesTable.innerHTML = '<tr><td colspan="2">Aucune absence enregistrée.</td></tr>';
            } else {
                // Add Total Row
                absencesTable.innerHTML = `<tr style="background: rgba(255,255,255,0.1);"><td colspan="2" style="color: #ff4b4b; font-size: 1.5rem; font-weight: bold; text-align: center;">Total Absences: ${mesAbsences.length}</td></tr>`;

                mesAbsences.forEach(a => {
                    absencesTable.innerHTML += `
                    <tr>
                        <td>${a.date}</td>
                        <td>${a.horaire}</td>
                    </tr>
                `;
                });
            }
        }

        // Cours
        const coursTable = document.querySelector('#mesCoursList tbody');
        if (coursTable) {
            coursTable.innerHTML = '';
            const mesCours = data.cours.filter(c => c.annee === currentUser.annee);

            if (mesCours.length === 0) {
                coursTable.innerHTML = '<tr><td colspan="3">Aucun cours disponible.</td></tr>';
            } else {
                mesCours.forEach(c => {
                    const module = data.modules.find(m => m.id === c.moduleId);
                    coursTable.innerHTML += `
                    <tr>
                        <td>${c.titre}</td>
                        <td>${module ? module.nom : '-'}</td>
                         <td><a href="${c.fichierData}" target="_blank" style="color:var(--accent); font-size: 1.2rem;" title="Télécharger"><i class="fas fa-download"></i></a></td>
                    </tr>
                 `;
                });
            }
        }

        // Shared sections for Stagiaire
        console.log('Loading calendrier...');
        afficherCalendrier('calendrierListStagiaire');
        console.log('Loading sujets...');
        afficherSujets('examensListStagiaire');
        console.log('Loading settings...');
        loadSettingsStagiaire();
        console.log('--- loadStagiaireData COMPLETED ---');
    } catch (error) {
        console.error('❌ ERROR in loadStagiaireData:', error);
        console.error('Error stack:', error.stack);
        alert('Erreur lors du chargement des données. Consultez la console (F12) pour plus de détails.');
    }
}

// Calendrier (Modified to accept containerID)
function afficherCalendrier(containerId = 'calendrierList') {
    console.log(`afficherCalendrier called for ${containerId}`);
    const list = document.getElementById(containerId);
    if (!list) {
        console.error(`Container ${containerId} NOT FOUND`);
        return;
    }
    list.innerHTML = '';

    // Mock data if empty
    let examens = data.datesExamens && data.datesExamens.length > 0 ? data.datesExamens : [];

    // If no real data, use mock data for demo
    if (examens.length === 0) {
        list.innerHTML = '<div style="text-align: center; color: var(--text-secondary); padding: 20px;">Aucune date d\'examen programmée.</div>';
        return;
    }

    examens.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Filter if Stagiaire
    if (currentUser && currentUser.role === 'stagiaire') {
        const userAnnee = currentUser.annee; // '1A' or '2A'
        // Filter exams that match user year OR have no year specified (legacy/global)
        examens = examens.filter(e => !e.annee || e.annee === userAnnee);
    }

    if (examens.length === 0) {
        list.innerHTML = '<div style="text-align: center; color: var(--text-secondary); padding: 20px;">Aucune date d\'examen programmée pour votre niveau.</div>';
        return;
    }

    examens.sort((a, b) => new Date(a.date) - new Date(b.date));

    examens.forEach(ex => {
        // Display time range
        const timeDisplay = (ex.heureDebut && ex.heureFin)
            ? `${ex.heureDebut} - ${ex.heureFin}`
            : (ex.heure || '');

        // Year Badge (Show if Formateur or if useful context)
        const yearBadge = ex.annee ? `<span class="badge badge-primary" style="margin-left: 10px; font-size: 0.7em;">${ex.annee}</span>` : '';

        list.innerHTML += `
            <div class="timeline-item" style="display: flex; gap: 15px; margin-bottom: 20px; border-left: 3px solid var(--primary); padding-left: 20px; position: relative;">
                <div style="min-width: 80px; font-weight: bold; color: var(--accent);">
                    ${new Date(ex.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                </div>
                <div>
                    <h4 style="margin: 0; color: white; display: flex; align-items: center;">
                        ${ex.titre} ${yearBadge}
                    </h4>
                    <small style="color: var(--text-secondary);"><i class="far fa-clock"></i> ${timeDisplay}</small>
                </div>
            </div>
        `;
    });
}

// Sujets d'Examen (Modified to accept containerID)
function afficherSujets(containerId = 'examensList') {
    const table = document.getElementById(containerId);
    // Handle both table ID directly or tbody inside it
    const tbody = table ? table.querySelector('tbody') : document.querySelector(`#${containerId} tbody`);

    if (!tbody) return;
    tbody.innerHTML = '';

    // Mock data if empty
    let sujets = data.examens && data.examens.length > 0 ? data.examens : [];

    if (sujets.length === 0) {
        sujets = [];
    }

    // Filter by year if connected user is stagiaire
    if (currentUser && currentUser.role === 'stagiaire') {
        sujets = sujets.filter(s => s.annee === currentUser.annee);
    }

    sujets.forEach(s => {
        // Correct download link or mock alert if no file
        const downloadAction = s.fichierData
            ? `window.open('${s.fichierData}', '_blank')`
            : `alert('Téléchargement simulé pour: ${s.titre}')`;

        const isStagiaire = currentUser && currentUser.role === 'stagiaire';

        tbody.innerHTML += `
            <tr>
                <td>${s.titre}</td>
                ${!isStagiaire ? `<td><span class="badge badge-primary">${s.annee}</span></td>` : ''}
                <td>
                    <button class="btn btn-sm" onclick="${downloadAction}">
                        <i class="fas fa-download"></i>
                    </button>
                    ${currentUser.role === 'formateur' ? `
                    <button class="btn btn-sm btn-danger" onclick="supprimerSujet(${s.id}, '${s.titre}')">
                        <i class="fas fa-trash"></i>
                    </button>` : ''}
                </td>
            </tr>
        `;
    });
}

function supprimerSujet(titre) {
    if (confirm(`Voulez-vous vraiment supprimer le sujet "${titre}" ?`)) {
        // Remove from data (Mock)
        data.examens = data.examens.filter(e => e.titre !== titre);
        // Refresh displays
        afficherSujets('examensList');
        // Also refresh stagiaire list if visible/applicable, but usually handled by reload or switchTab
        alert('Sujet supprimé avec succès.');
    }
}

// Settings Logic
function loadSettings() {
    if (!currentUser) return;
    const nameInput = document.getElementById('paramsNom');
    if (nameInput) nameInput.value = `${currentUser.nom} ${currentUser.prenom}`;

    // Admin features for Formateur
    if (currentUser.role === 'formateur') {
        const adminSection = document.getElementById('adminStagiairesSection');
        if (adminSection) {
            adminSection.style.display = 'block';
            filterStagiairesAdmin(); // Initial populate
        }
    }
}

function filterStagiairesAdmin() {
    const select = document.getElementById('selectStagiaireAdmin');
    const filterYear = document.getElementById('filterAdminAnnee').value;

    if (select && data.stagiaires) {
        select.innerHTML = '<option value="">-- Choisir un stagiaire --</option>';

        let filtered = data.stagiaires;
        if (filterYear) {
            filtered = filtered.filter(s => s.annee === filterYear);
        }

        filtered.forEach(s => {
            select.innerHTML += `<option value="${s.id}">${s.nom} ${s.prenom} (${s.annee})</option>`;
        });
    }
}

// Settings Logic Stagiaire
function loadSettingsStagiaire() {
    try {
        console.log('loadSettingsStagiaire called');
        // Populate current user info
        if (currentUser && currentUser.role === 'stagiaire') {
            const nameInput = document.getElementById('paramsNomStagiaire');
            if (nameInput) {
                nameInput.value = `${currentUser.nom} ${currentUser.prenom}`;
                console.log('Settings loaded for stagiaire:', currentUser.nom);
            } else {
                console.warn('paramsNomStagiaire input not found');
            }

            // Dark Mode Logic
            const darkModeToggle = document.getElementById('darkModeStagiaire');
            if (darkModeToggle) {
                // Load preference
                const isDarkMode = localStorage.getItem('theme') !== 'light';
                darkModeToggle.checked = isDarkMode;
                if (!isDarkMode) {
                    document.body.classList.add('light-mode');
                } else {
                    document.body.classList.remove('light-mode');
                }

                // Event Listener
                // Avoid adding multiple listeners if function is called multiple times
                const newToggle = darkModeToggle.cloneNode(true);
                darkModeToggle.parentNode.replaceChild(newToggle, darkModeToggle);

                newToggle.addEventListener('change', function () {
                    if (this.checked) {
                        document.body.classList.remove('light-mode');
                        localStorage.setItem('theme', 'dark');
                    } else {
                        document.body.classList.add('light-mode');
                        localStorage.setItem('theme', 'light');
                    }
                });
            }
        }
    } catch (error) {
        console.error('Error in loadSettingsStagiaire:', error);
    }
}

function saveSettingsStagiaire() {
    const newPassInput = document.getElementById('newPasswordStagiaire');
    const confirmPassInput = document.getElementById('confirmNewPasswordStagiaire'); // Ensure ID matches HTML

    if (newPassInput && newPassInput.value.length > 0) {
        if (!confirmPassInput || newPassInput.value !== confirmPassInput.value) {
            alert("Erreur: La confirmation du mot de passe ne correspond pas.");
            return;
        }
        alert("Simulation: Mot de passe mis à jour avec succès !");
        newPassInput.value = '';
        confirmPassInput.value = '';
    } else {
        alert("Préférences enregistrées avec succès !");
    }
}

function changeStagiairePassword() {
    const select = document.getElementById('selectStagiaireAdmin');
    const passwordInput = document.getElementById('newStagiairePassword');
    const confirmInput = document.getElementById('confirmStagiairePassword');

    if (!select || !select.value) {
        alert("Veuillez sélectionner un stagiaire.");
        return;
    }

    if (!passwordInput || passwordInput.value.length < 4) {
        alert("Veuillez entrer un mot de passe d'au moins 4 caractères.");
        return;
    }

    if (!confirmInput || passwordInput.value !== confirmInput.value) {
        alert("Les mots de passe ne correspondent pas.");
        return;
    }

    const stagiaireId = select.value;
    // Loose equality check for ID types (string vs number)
    const stagiaire = data.stagiaires.find(s => s.id == stagiaireId);

    if (stagiaire) {
        alert(`Simulation: Le mot de passe pour ${stagiaire.nom} ${stagiaire.prenom} a été modifié avec succès.`);
        passwordInput.value = '';
        confirmInput.value = '';
    } else {
        alert("Erreur: Stagiaire non trouvé.");
    }
}

function saveSettings() {
    // Email notification logic removed

    const newPassInput = document.getElementById('newPassword');
    if (newPassInput && newPassInput.value.length > 0) {
        alert("Simulation: VOTRE mot de passe a été mis à jour avec succès !");
        newPassInput.value = '';
    }

    alert("Préférences enregistrées avec succès !");
}

function changeStagiairePassword() {
    const select = document.getElementById('selectStagiaireAdmin');
    const passwordInput = document.getElementById('newStagiairePassword');

    if (!select || !select.value) {
        alert("Veuillez sélectionner un stagiaire.");
        return;
    }

    if (!passwordInput || passwordInput.value.length < 4) {
        alert("Veuillez entrer un mot de passe d'au moins 4 caractères.");
        return;
    }

    const stagiaireId = select.value;
    const stagiaire = data.stagiaires.find(s => s.id == stagiaireId);

    if (stagiaire) {
        alert(`Simulation: Le mot de passe pour ${stagiaire.nom} ${stagiaire.prenom} a été modifié avec succès.`);
        passwordInput.value = '';
    } else {
        alert("Erreur: Stagiaire non trouvé.");
    }
}

function chargerModulesPublication() {
    console.log('--- chargerModulesPublication called ---');
    const anneeSelect = document.getElementById('coursAnnee');
    const moduleSelect = document.getElementById('coursModule');

    if (!anneeSelect || !moduleSelect) {
        console.error('Elements not found: coursAnnee or coursModule');
        return;
    }

    const annee = anneeSelect.value;
    console.log('Selected year:', annee);

    moduleSelect.innerHTML = '<option value="">-- Choisir un module --</option>';

    if (annee && data.modules) {
        const modules = data.modules.filter(m => m.annee === annee);
        console.log('Found modules:', modules.length);
        modules.forEach(m => {
            moduleSelect.innerHTML += `<option value="${m.id}">${m.nom}</option>`;
        });
    } else {
        console.log('No year selected or no modules data');
    }
}
