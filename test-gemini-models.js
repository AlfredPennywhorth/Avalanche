const apiKey = "AIzaSyDToflRbVr0xQYbNoTv_0ZAMBr8iYHYA3A";

async function listModels() {
    try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        const data = await res.json();
        console.log("Response:", JSON.stringify(data.models.map(m => m.name), null, 2));
    } catch (error) {
        console.error("Fetch Error:", error);
    }
}

listModels();
