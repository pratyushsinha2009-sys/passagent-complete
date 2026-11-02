import math,wave,array,random
rate=32000;duration=36;beat=.5
samples=array.array('h');rng=random.Random(219)
# Warm major-key product music, with edits on the 120 BPM beat grid.
chords=[(146.832,184.997,220),(123.471,146.832,184.997),(97.999,123.471,146.832),(110,138.591,164.814)]
cues=[3,8,13,18,23,27,32]
for i in range(rate*duration):
 t=i/rate;chord=chords[int(t/4)%4];phase=t%beat;eighth=t%(beat/2);step=int(t/(beat/2))
 note=chord[[0,2,1,2,0,1,2,1][step%8]]*4
 piano=(math.sin(2*math.pi*note*t)+.22*math.sin(4*math.pi*note*t)+.08*math.sin(6*math.pi*note*t))*math.exp(-eighth*8)*.13
 pad=sum(math.sin(2*math.pi*n*t)+.22*math.sin(2*math.pi*n*1.002*t) for n in chord)*.027
 bass=math.sin(2*math.pi*chord[0]/2*t)*math.exp(-phase*4)*.14
 kick=math.sin(2*math.pi*(47*phase+1.5*(1-math.exp(-phase*35))))*math.exp(-phase*25)*.22
 hat=(rng.random()*2-1)*math.exp(-eighth*110)*.027
 snare=(rng.random()*2-1)*math.exp(-phase*42)*(.07 if int(t/beat)%4 in (1,3) else 0)
 fx=0
 for cue in cues:
  dt=t-cue
  if -.20<dt<0:fx+=(rng.random()*2-1)*((dt+.2)/.2)**2*.045
  if 0<=dt<.4:fx+=math.sin(2*math.pi*1174.659*t)*math.exp(-dt*16)*.055
 fade=min(1,t/.08,(duration-t)/1.0)
 for channel in (0,1):
  width=math.sin(2*math.pi*chord[1]*t)*.015*(1 if channel else -1)
  val=math.tanh((piano+pad+bass+kick+hat+snare+fx+width)*1.2)*fade
  samples.append(round(val*29000))
with wave.open('public/passagent-flow.wav','wb') as out:
 out.setnchannels(2);out.setsampwidth(2);out.setframerate(rate);out.writeframes(samples.tobytes())
print('36s stereo BGM, 120 BPM, seven synchronized edit accents.')
