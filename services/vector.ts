import { initLlama, LlamaContext } from 'llama.rn';

let vectorContext: { llama: LlamaContext | null } = {
    llama: null
};

export const getVectorContext = () => {
    return vectorContext;
}

export const loadVectorContext = async () => {
    if (vectorContext.llama) {
        return vectorContext;
    }
    try {
        vectorContext.llama = await initLlama({
            model: 'file://bge-small-en-v1.5-q4_k_m.gguf', // embedding-specific model
            is_model_asset: true,
            n_ctx: 512,  // smaller context for embeddings
            n_gpu_layers: 0, // CPU only for embeddings
            embedding: true // enable embedding mode
        });
        console.log('Vector context loaded for embeddings');
        return vectorContext;
    } catch (error) {
        console.error('Error loading vector context:', error);
        return false;
    }
}

export const unloadVectorContext = async () => {
    if (vectorContext.llama) {
        await vectorContext.llama.release();
        vectorContext.llama = null;
    }
}

export const generateEmbedding = async (text: string): Promise<number[] | null> => {
    if (!vectorContext.llama) {
        console.error('Vector context not initialized');
        return null;
    }

    try {
        const embedding = await vectorContext.llama.embedding(text);
        return embedding.embedding;
    } catch (error) {
        console.error('Error generating embedding:', error);
        return null;
    }
}

// Utility function to calculate cosine similarity between two embeddings
export const cosineSimilarity = (embedding1: number[], embedding2: number[]): number => {
    if (embedding1.length !== embedding2.length) {
        throw new Error('Embeddings must have the same length');
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
        dotProduct += embedding1[i] * embedding2[i];
        norm1 += embedding1[i] * embedding1[i];
        norm2 += embedding2[i] * embedding2[i];
    }

    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
} 