import { Octokit } from "octokit";

const octokit = new Octokit({
    auth: import.meta.env.VITE_GITHUB_TOKEN
});

export const getRepo = async (owner, repo) => {
    try {
        const response = await octokit.request('GET /repos/{owner}/{repo}', {
            owner,
            repo,
            headers: {
                'X-GitHub-Api-Version': '2022-11-28'
            }
        });
        return response.data;
    } catch (error) {
        console.error("Erro ao buscar repositório:", error);
        throw error;
    }
};

export default octokit;
