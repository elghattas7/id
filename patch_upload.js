const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'assets/js/app_bundled.js');
const fileContent = fs.readFileSync(filePath, 'utf8');

const oldCodeSnippet = `    // Generate unique file path
    const filePath = \`examens/\${Date.now()}_\${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}\`;

    // Upload to Supabase Storage
    supabase.storage.from('examens').upload(filePath, file)
        .then(({ data: uploadData, error: uploadError }) => {
            if (uploadError) {
                console.error('Error uploading file:', uploadError);
                alert("Erreur lors de l'upload du fichier: " + uploadError.message);
                return;
            }

            // Get Public URL
            const { data: urlData } = supabase.storage.from('examens').getPublicUrl(filePath);
            const publicURL = urlData.publicUrl;

            // Insert into Supabase 'examens' table
            return supabase.from('examens').insert([{
                titre: titre,
                annee: annee,
                fichier_nom: file.name,
                fichier_url: publicURL
            }]).then(({ error }) => {
                if (error) {
                    console.error('Error inserting sujet:', error);
                    alert("Erreur base de données: " + error.message);
                } else {
                    // Update local data
                    const newExamen = {
                        id: Date.now(), // Temporary ID until refresh
                        titre: titre,
                        annee: annee,
                        fichierData: publicURL,
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
        })
        .catch(err => {
            console.error('Unexpected error:', err);
            alert("Une erreur inattendue est survenue.");
        });`;

const newCodeSnippet = `    // Use FileReader to convert to Base64 (No Bucket required)
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
    };`;

// Normalize line endings to avoid issues
const normalizedFileContent = fileContent.replace(/\r\n/g, '\n');
const normalizedOldCode = oldCodeSnippet.replace(/\r\n/g, '\n');

// Use Regex to find the block
// Match from "// Generate unique file path" ... down to ... "alert("Une erreur inattendue est survenue.");" and the closing braces
const regexPattern = /\/\/ Generate unique file path[\s\S]*?alert\("Une erreur inattendue est survenue\."\);\s*\}\);/m;

const match = normalizedFileContent.match(regexPattern);

if (match) {
    console.log('Found match!');
    const newContent = normalizedFileContent.replace(regexPattern, newCodeSnippet);
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log('Successfully patched app_bundled.js using REGEX');
} else {
    console.error('Could not find match with REGEX.');
    // Debug: print a substring of the file to see what it looks like
    const startIdx = normalizedFileContent.indexOf('const filePath = `examens/');
    if (startIdx !== -1) {
        console.log('Found snippet start at index:', startIdx);
        console.log('Snippet from file:', normalizedFileContent.substring(startIdx, startIdx + 200));
    } else {
        console.log('Could not even find the start of the snippet.');
    }
}
