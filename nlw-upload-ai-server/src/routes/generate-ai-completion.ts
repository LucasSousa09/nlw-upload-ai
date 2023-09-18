import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { streamToResponse, OpenAIStream } from 'ai'
import { prisma } from '../lib/prisma'
import { openai } from '../lib/opeai'

export async function generateAiCompletionRoute(app: FastifyInstance){
    app.post('/ai/generate', async (request, reply) => {
        const bodySchema = z.object({
            videoId: z.string().uuid(),
            prompt: z.string(),
            temperature: z.number().min(0).max(1).default(0.5)
        })

        const { videoId, temperature, prompt } = bodySchema.parse(request.body)

        const video = await prisma.video.findUniqueOrThrow({
            where: {
                id: videoId
            }
        })

        if(!video.transcription){
            return reply.status(400).send({error: 'Video transcription was not generated yet.'})
        }

        const promptMessage = prompt.replace('{transcription}', video.transcription)

        const response = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo-16k',
            temperature,
            messages: [
                {role: 'user', content: promptMessage}
            ],
            stream: true
        })

        const stream = OpenAIStream(response)

        streamToResponse(stream, reply.raw, {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow_Methods': 'GET, POST, PUT, DELETE, OPTIONS '
            }
        })
    })
}