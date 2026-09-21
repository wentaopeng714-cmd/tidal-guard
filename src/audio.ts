export class Sound {
  enabled=false;context:AudioContext|null=null;
  unlock(){if(!this.context)this.context=new AudioContext();if(this.context.state==='suspended')void this.context.resume();}
  tone(frequency:number,duration:number,volume=.035,type:OscillatorType='sine',end?:number){
    if(!this.enabled||!this.context)return;
    const c=this.context,o=c.createOscillator(),gain=c.createGain();o.type=type;o.frequency.setValueAtTime(frequency,c.currentTime);if(end)o.frequency.exponentialRampToValueAtTime(end,c.currentTime+duration);
    gain.gain.setValueAtTime(volume,c.currentTime);gain.gain.exponentialRampToValueAtTime(.001,c.currentTime+duration);o.connect(gain);gain.connect(c.destination);o.start();o.stop(c.currentTime+duration);
  }
  play(type:string){if(type==='shot')this.tone(530,.07,.012,'triangle',260);if(type==='kill')this.tone(1050,.12,.03,'sine',1600);if(type==='buy')this.tone(660,.25,.05,'triangle',1320);if(type==='leak')this.tone(140,.3,.055,'sawtooth',65);if(type==='burst')this.tone(180,.65,.06,'triangle',1200);if(type==='wave')this.tone(660,.35,.03,'sine',990);}
}
