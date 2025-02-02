import { initLlama, LlamaContext } from 'llama.rn';

let llamaContext: { llama: LlamaContext | null } = {
    llama: null
};

export const getLlamaContext = () => {
    return llamaContext;
}

export const loadLlamaContext = async () => {
    if (llamaContext.llama != null) {
        return llamaContext;
    }
    try {
        llamaContext.llama = await initLlama({
            model: 'file://Parm2-Qwen2.5-3B.Q4_K_M.gguf',
            is_model_asset: true,
            n_ctx: 4096,  
            n_gpu_layers: 36
        });
        console.log('Llama context loaded');
        return llamaContext;
    } catch (error) {
        console.error('Error loading Llama context:', error);
        return false;
    }
}

export const unloadLlamaContext = async () => {
    if (llamaContext.llama != null) {
        await llamaContext.llama.release();
        llamaContext.llama = null;
    }
}