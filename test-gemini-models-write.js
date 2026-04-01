import fs from 'fs';
const apiKey = "AIzaSyDToflRbVr0xQYbNoTv_0ZAMBr8iYHYA3A";

async function listModels() {
    try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        const data = await res.json();
        const names = data.models.map(m => m.name);
        fs.writeFileSync('models-clean.txt', JSON.stringify(names, null, 2), 'utf-8');
        console.log("Done");
    } catch (error) {
        console.error("Fetch Error:", error);
    }
}

listModels();
