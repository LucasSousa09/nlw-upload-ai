import { FileVideo, Upload } from "lucide-react";
import { Separator } from "./ui/separator";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Button } from "./ui/button";
import { ChangeEvent, FormEvent, useMemo, useRef, useState } from "react";
import { getFfmpeg } from "@/lib/ffmprg";
import { fetchFile } from '@ffmpeg/util'

import { api } from '../lib/axios'

type Status = 'waiting' | 'converting' | 'uploading' | 'generating' | 'success'

const statusMessages = {
    converting: 'Convertendo...',
    uploading: 'Transcrevendo',
    generating: 'Carregando',
    success: 'Sucesso'
}

interface VideoInputFormProps {
    onVideoUploaded: (id: string) => void
}

export function VideoInputForm({onVideoUploaded}: VideoInputFormProps){
    const [ videoFile, setVideoFile ] = useState<File | null>(null)
    const [ status, setStatus ] = useState<Status>('waiting')

    const promptInputRef = useRef<HTMLTextAreaElement>(null)

    function handleFileSelected(event: ChangeEvent<HTMLInputElement>){
        const { files } = event.currentTarget

        if(!files){
            return
        }

        const selectedFile = files[0]

        setVideoFile(selectedFile)
    }

    const previewURL = useMemo(() => {
        
        if(!videoFile){
            return null
        }

        return URL.createObjectURL(videoFile)

    }, [videoFile])


    async function convertVideoToAudio(video: File){
        console.log('Convert started')

        const ffmpeg = await getFfmpeg()

        await ffmpeg.writeFile('input.mp4', await fetchFile(video))

        // ffmpeg.on('log', log => {
        //     console.log(log)
        // })

        ffmpeg.on('progress', progress => {
            console.log('Convert progress:' + Math.round(progress.progress * 100))
        })
        
        await ffmpeg.exec([
            '-i',
            'input.mp4',
            '-map',
            '0:a',
            '-b:a',
            '20k',
            '-acodec',
            'libmp3lame',
            'output.mp3'
        ])

        const data = await ffmpeg.readFile('output.mp3')

        const audioFileBlob = new Blob([data], {type: 'audio/mpeg'})
        const audioFile = new File([audioFileBlob], 'audio.mp3', {
            type: 'audio/mpeg'
        })

        return audioFile
    }

    async function handleUploadVideo(event: FormEvent<HTMLFormElement>){
        event.preventDefault()

        const prompt = promptInputRef.current?.value

        if(!videoFile){
            return
        }

        setStatus('converting')

        const audioFile = await convertVideoToAudio(videoFile)

        const data = new FormData()

        data.append('file', audioFile)

        setStatus('uploading')

        const response = await api.post('/videos', data)

        const videoId = response.data.video.id

        
        setStatus('generating')
        
        await api.post(`/videos/${videoId}/transcription`, {
            prompt
        })
        
        setStatus("success")
        
        onVideoUploaded(videoId)
    }



    return (
        <form className="space-y-6" onSubmit={handleUploadVideo}>
            <label className="relative overflow-hidden border flex rounded-md aspect-video cursor-pointer border-dashed text-sm flex-col gap-2 items-center justify-center text-muted-foreground hover:bg-primary/5" htmlFor="video">
                {
                    previewURL ? (
                        <video src={previewURL} controls={false} className="pointer-events-none absolute inset-0"></video>
                    ) : (
                        <>
                            <FileVideo className="w-5 h-5"/>
                            Selecione um vídeo
                        </>
                    )
                }
            </label>
            
            <input type="file" accept="video/mp4" id="video" className="sr-only" onChange={handleFileSelected} />

            <Separator/>

            <div className="space-y-2">
                <Label  htmlFor="transcription_prompt">
                    Prompt de Transcrição
                </Label>
                <Textarea
                    disabled={status !== 'waiting'} 
                    id="transcription_prompt"
                    ref={promptInputRef} 
                    className="p-3 h-20 leading-relaxed resize-none" 
                    placeholder='Inclua palavras-chave mencionadas no vídeo separadas por virgula (,)'
                />
            </div>

            <Button 
                disabled={status !== 'waiting'} 
                type="submit" 
                className="w-full data-[success=true]:bg-emerald-400"
                data-success={status === 'success'}
            >
                {
                    status === 'waiting' ? (
                        <>
                            Carregar vídeo
                            <Upload  className="w-4 h-4 ml-2"/>
                        </>
                    ) : statusMessages[status]
                }
            </Button>
        </form>
    )
}

