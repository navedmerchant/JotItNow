import Voice, {
  SpeechResultsEvent,
  SpeechErrorEvent,
} from '@react-native-voice/voice';

class VoiceService {
  private static instance: VoiceService;
  private isListening: boolean = false;
  private onTranscriptionCallback?: (text: string[]) => void;

  private constructor() {
    Voice.onSpeechStart = this.onSpeechStart;
    Voice.onSpeechEnd = this.onSpeechEnd;
    Voice.onSpeechResults = this.onSpeechResults;
    Voice.onSpeechError = this.onSpeechError;
  }

  public static getInstance(): VoiceService {
    if (!VoiceService.instance) {
      VoiceService.instance = new VoiceService();
    }
    return VoiceService.instance;
  }

  private onSpeechStart = () => {
    this.isListening = true;
  };

  private onSpeechEnd = () => {
    this.isListening = false;
  };

  private onSpeechResults = (event: SpeechResultsEvent) => {
    if (this.onTranscriptionCallback && event.value) {
      this.onTranscriptionCallback(event.value);
    }
    return event.value ?? [];
  };

  private onSpeechError = (error: SpeechErrorEvent) => {
    console.error('Speech recognition error:', error);
    this.isListening = false;
  };

  public async startListening(): Promise<void> {
    try {
      if (!this.isListening) {
        await Voice.start('en-US');
      }
    } catch (error) {
      console.error('Error starting voice recognition:', error);
      throw error;
    }
  }

  public async stopListening(): Promise<void> {
    try {
      if (this.isListening) {
        await Voice.stop();
      }
    } catch (error) {
      console.error('Error stopping voice recognition:', error);
      throw error;
    }
  }

  public async destroy(): Promise<void> {
    try {
      await Voice.destroy();
    } catch (error) {
      console.error('Error destroying voice instance:', error);
      throw error;
    }
  }

  public isRecording(): boolean {
    return this.isListening;
  }

  public setOnTranscriptionCallback(callback: (text: string[]) => void) {
    this.onTranscriptionCallback = callback;
  }
}

export default VoiceService;
