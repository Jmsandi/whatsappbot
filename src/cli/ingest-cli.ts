#!/usr/bin/env node

import { Command } from 'commander';
import path from 'path';
import { IngestClient } from '../geneline/ingest-client';
import { FileProcessor } from '../utils/file-processor';
import { config } from '../config/env';
import { logger } from '../utils/logger';
import { IngestJobStatus } from '../geneline/ingest-types';

const program = new Command();

program
    .name('ingest')
    .description('Upload documents to Geneline-X knowledge base')
    .version('1.0.0');

program
    .command('file')
    .description('Upload a PDF file to the knowledge base')
    .argument('<file>', 'Path to the PDF file')
    .option('-t, --title <title>', 'Document title')
    .option('-d, --description <description>', 'Document description')
    .option('-c, --category <category>', 'Document category')
    .option('--no-wait', 'Do not wait for job completion')
    .action(async (filePath: string, options: any) => {
        try {
            console.log('\n📄 Geneline-X Document Ingestion\n');
            console.log('='.repeat(50));

            // Resolve file path
            const absolutePath = path.resolve(filePath);
            console.log(`📁 File: ${absolutePath}`);

            // Validate file
            const validation = FileProcessor.validateFilePath(absolutePath);
            if (!validation.valid) {
                console.error(`❌ Error: ${validation.error}`);
                process.exit(1);
            }

            // Process file
            const processor = new FileProcessor(config.ingest.maxFileSizeMB);
            console.log('\n⏳ Processing file...');
            const { buffer, metadata } = await processor.processFile(absolutePath);

            console.log(`✅ File processed successfully`);
            console.log(`   Size: ${FileProcessor.formatFileSize(metadata.size)}`);
            console.log(`   Type: ${metadata.mimeType}`);
            if (metadata.pages) {
                console.log(`   Pages: ${metadata.pages}`);
            }

            // Upload file
            console.log('\n⬆️  Uploading to Geneline-X...');
            const client = new IngestClient();
            const response = await client.ingestFile({
                chatbotId: config.geneline.chatbotId,
                file: buffer,
                filename: metadata.filename,
                mimeType: metadata.mimeType,
                metadata: {
                    title: options.title,
                    description: options.description,
                    category: options.category,
                    pages: metadata.pages,
                },
            });

            console.log(`✅ Upload initiated`);
            console.log(`   Job ID: ${response.jobId}`);

            if (options.wait !== false) {
                console.log('\n⏳ Waiting for job completion...');
                console.log('   (This may take a few minutes)\n');

                const finalStatus = await client.waitForJobCompletion(
                    response.jobId,
                    (status: IngestJobStatus) => {
                        const timestamp = new Date().toLocaleTimeString();
                        console.log(`   [${timestamp}] Status: ${status.status.toUpperCase()}`);
                        if (status.progress) {
                            console.log(`   Progress: ${status.progress}%`);
                        }
                        if (status.message) {
                            console.log(`   Message: ${status.message}`);
                        }
                    }
                );

                console.log('\n✅ Job completed successfully!');
                console.log(`   Completed at: ${finalStatus.completedAt}`);
                console.log('\n🎉 Your document has been added to the knowledge base!');
            } else {
                console.log('\n✅ Upload complete!');
                console.log(`   Check job status with: npm run ingest status ${response.jobId}`);
            }

            console.log('='.repeat(50) + '\n');
        } catch (error) {
            console.error('\n❌ Error:', (error as Error).message);
            logger.error('Ingestion failed', error as Error);
            process.exit(1);
        }
    });

program
    .command('url')
    .description('Ingest a document from a URL')
    .argument('<url>', 'URL of the document')
    .option('-t, --title <title>', 'Document title')
    .option('-d, --description <description>', 'Document description')
    .option('-c, --category <category>', 'Document category')
    .option('--no-wait', 'Do not wait for job completion')
    .action(async (url: string, options: any) => {
        try {
            console.log('\n🌐 Geneline-X URL Ingestion\n');
            console.log('='.repeat(50));
            console.log(`🔗 URL: ${url}`);

            console.log('\n⏳ Initiating ingestion...');
            const client = new IngestClient();
            const response = await client.ingestUrl({
                chatbotId: config.geneline.chatbotId,
                url,
                metadata: {
                    title: options.title,
                    description: options.description,
                    category: options.category,
                },
            });

            console.log(`✅ Ingestion initiated`);
            console.log(`   Job ID: ${response.jobId}`);

            if (options.wait !== false) {
                console.log('\n⏳ Waiting for job completion...');
                console.log('   (This may take a few minutes)\n');

                const finalStatus = await client.waitForJobCompletion(
                    response.jobId,
                    (status: IngestJobStatus) => {
                        const timestamp = new Date().toLocaleTimeString();
                        console.log(`   [${timestamp}] Status: ${status.status.toUpperCase()}`);
                        if (status.progress) {
                            console.log(`   Progress: ${status.progress}%`);
                        }
                    }
                );

                console.log('\n✅ Job completed successfully!');
                console.log(`   Completed at: ${finalStatus.completedAt}`);
                console.log('\n🎉 Your document has been added to the knowledge base!');
            } else {
                console.log('\n✅ Ingestion started!');
                console.log(`   Check job status with: npm run ingest status ${response.jobId}`);
            }

            console.log('='.repeat(50) + '\n');
        } catch (error) {
            console.error('\n❌ Error:', (error as Error).message);
            logger.error('URL ingestion failed', error as Error);
            process.exit(1);
        }
    });

program
    .command('status')
    .description('Check the status of an ingestion job')
    .argument('<jobId>', 'Job ID to check')
    .action(async (jobId: string) => {
        try {
            console.log('\n📊 Job Status\n');
            console.log('='.repeat(50));

            const client = new IngestClient();
            const status = await client.getJobStatus(jobId);

            console.log(`Job ID: ${status.jobId}`);
            console.log(`Status: ${status.status.toUpperCase()}`);
            if (status.progress) {
                console.log(`Progress: ${status.progress}%`);
            }
            if (status.message) {
                console.log(`Message: ${status.message}`);
            }
            if (status.error) {
                console.log(`Error: ${status.error}`);
            }
            console.log(`Created: ${status.createdAt}`);
            console.log(`Updated: ${status.updatedAt}`);
            if (status.completedAt) {
                console.log(`Completed: ${status.completedAt}`);
            }

            console.log('='.repeat(50) + '\n');
        } catch (error) {
            console.error('\n❌ Error:', (error as Error).message);
            logger.error('Failed to get job status', error as Error);
            process.exit(1);
        }
    });

program
    .command('list')
    .description('List all ingestion jobs')
    .action(async () => {
        try {
            console.log('\n📋 Ingestion Jobs\n');
            console.log('='.repeat(50));

            const client = new IngestClient();
            const response = await client.listJobs();

            if (response.jobs.length === 0) {
                console.log('No jobs found.');
            } else {
                console.log(`Total jobs: ${response.total}\n`);
                response.jobs.forEach((job, index) => {
                    console.log(`${index + 1}. Job ID: ${job.jobId}`);
                    console.log(`   Status: ${job.status.toUpperCase()}`);
                    console.log(`   Created: ${job.createdAt}`);
                    if (job.completedAt) {
                        console.log(`   Completed: ${job.completedAt}`);
                    }
                    console.log('');
                });
            }

            console.log('='.repeat(50) + '\n');
        } catch (error) {
            console.error('\n❌ Error:', (error as Error).message);
            logger.error('Failed to list jobs', error as Error);
            process.exit(1);
        }
    });

program
    .command('json')
    .description('Ingest JSON data into the knowledge base')
    .argument('<file>', 'Path to the JSON file')
    .option('-t, --title <title>', 'Dataset title')
    .option('-d, --description <description>', 'Dataset description')
    .option('-c, --category <category>', 'Dataset category')
    .option('--no-wait', 'Do not wait for job completion')
    .action(async (filePath: string, options: any) => {
        try {
            console.log('\n📊 Geneline-X JSON Data Ingestion\n');
            console.log('='.repeat(50));

            // Resolve file path
            const absolutePath = path.resolve(filePath);
            console.log(`📁 File: ${absolutePath}`);

            // Read and parse JSON
            const fs = await import('fs/promises');
            console.log('\n⏳ Reading JSON file...');
            const jsonContent = await fs.readFile(absolutePath, 'utf-8');
            const jsonData = JSON.parse(jsonContent);

            const recordCount = Array.isArray(jsonData) ? jsonData.length : 1;
            console.log(`✅ JSON parsed successfully`);
            console.log(`   Records: ${recordCount.toLocaleString()}`);

            // Prepare request
            const title = options.title || path.basename(filePath, '.json');
            console.log(`\n📝 Title: ${title}`);
            if (options.description) {
                console.log(`📝 Description: ${options.description}`);
            }
            if (options.category) {
                console.log(`🏷️  Category: ${options.category}`);
            }

            // Start ingestion
            console.log('\n⏳ Converting to markdown and uploading...');
            const client = new IngestClient();
            const result = await client.ingestJson({
                chatbotId: config.geneline.chatbotId,
                jsonData,
                title,
                description: options.description,
                category: options.category,
            });

            console.log(`\n✅ Upload initiated successfully!`);
            console.log(`   Job ID: ${result.jobId}`);

            if (options.wait !== false) {
                console.log('\n⏳ Waiting for processing to complete...');
                const finalStatus = await client.waitForJobCompletion(
                    result.jobId,
                    (status: IngestJobStatus) => {
                        console.log(`   Status: ${status.status} - ${status.message || ''}`);
                    }
                );

                if (finalStatus.status === 'completed') {
                    console.log('\n✅ JSON data ingested successfully!');
                    console.log('   The chatbot can now answer questions about this data.');
                } else {
                    console.log(`\n❌ Job failed: ${finalStatus.message}`);
                    process.exit(1);
                }
            } else {
                console.log('\nℹ️  Job started in background. Check status with:');
                console.log(`   npm run ingest status ${result.jobId}`);
            }
        } catch (error) {
            console.error(`\n❌ Error: ${(error as Error).message}`);
            logger.error('JSON ingestion failed', error as Error);
            process.exit(1);
        }
    });

program
    .command('csv')
    .description('Ingest CSV data into the knowledge base')
    .argument('<file>', 'Path to the CSV file')
    .option('-t, --title <title>', 'Dataset title')
    .option('-d, --description <description>', 'Dataset description')
    .option('-c, --category <category>', 'Dataset category')
    .option('--no-wait', 'Do not wait for job completion')
    .action(async (filePath: string, options: any) => {
        try {
            console.log('\n📊 Geneline-X CSV Data Ingestion\n');
            console.log('='.repeat(50));

            // Resolve file path
            const absolutePath = path.resolve(filePath);
            console.log(`📁 File: ${absolutePath}`);

            // Validate file exists
            const validation = FileProcessor.validateFilePath(absolutePath);
            if (!validation.valid) {
                console.error(`❌ Error: ${validation.error}`);
                process.exit(1);
            }

            // Prepare request
            const title = options.title || path.basename(filePath, '.csv');
            console.log(`\n📝 Title: ${title}`);
            if (options.description) {
                console.log(`📝 Description: ${options.description}`);
            }
            if (options.category) {
                console.log(`🏷️  Category: ${options.category}`);
            }

            // Start ingestion
            console.log('\n⏳ Parsing CSV and converting to markdown...');
            const client = new IngestClient();
            const result = await client.ingestCsv({
                chatbotId: config.geneline.chatbotId,
                csvPath: absolutePath,
                title,
                description: options.description,
                category: options.category,
            });

            console.log(`\n✅ Upload initiated successfully!`);
            console.log(`   Job ID: ${result.jobId}`);

            if (options.wait !== false) {
                console.log('\n⏳ Waiting for processing to complete...');
                const finalStatus = await client.waitForJobCompletion(
                    result.jobId,
                    (status: IngestJobStatus) => {
                        console.log(`   Status: ${status.status} - ${status.message || ''}`);
                    }
                );

                if (finalStatus.status === 'completed') {
                    console.log('\n✅ CSV data ingested successfully!');
                    console.log('   The chatbot can now answer questions about this data.');
                } else {
                    console.log(`\n❌ Job failed: ${finalStatus.message}`);
                    process.exit(1);
                }
            } else {
                console.log('\nℹ️  Job started in background. Check status with:');
                console.log(`   npm run ingest status ${result.jobId}`);
            }
        } catch (error) {
            console.error(`\n❌ Error: ${(error as Error).message}`);
            logger.error('CSV ingestion failed', error as Error);
            process.exit(1);
        }
    });

program.parse(process.argv);
