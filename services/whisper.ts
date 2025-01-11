import { initWhisper, WhisperContext } from 'whisper.rn'

let whisperContext: { whisper: WhisperContext | null } = {
    whisper: null
};

export const getWhisperContext = () => {
    return whisperContext;
}

export const loadWhisperContext = async () => {
    if (whisperContext.whisper) {
        return whisperContext;
    }
    try {
        whisperContext.whisper = await initWhisper({
            filePath: require('../assets/ggml-tiny-q8_0.bin'),
            useGpu: true, // Enable Metal (Will skip Core ML if enabled)
            useFlashAttn: true,
            useCoreMLIos: false,
        })
        console.log('Whisper context loaded');
        return whisperContext;
    } catch (error) {
        console.error('Error loading Whisper context:', error);
        return whisperContext;
    }
}

export const unloadWhisperContext = async () => {
    if (whisperContext.whisper) {
        await whisperContext.whisper.release();
        console.log('Whisper context unloaded');
        whisperContext.whisper = null;
    }
};