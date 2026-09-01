import crypto from 'node:crypto';
import { S3Client, HeadBucketCommand, CreateBucketCommand, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export class ObjectStorage {
  private readonly bucket = 'dentpilot-private';
  private readonly client: S3Client;
  constructor(endpoint: string, accessKeyId: string, secretAccessKey: string) { this.client=new S3Client({endpoint,region:'us-east-1',forcePathStyle:true,credentials:{accessKeyId,secretAccessKey}}); }
  async ensureBucket(): Promise<void> { try { await this.client.send(new HeadBucketCommand({Bucket:this.bucket})); } catch { await this.client.send(new CreateBucketCommand({Bucket:this.bucket})); } }
  async readiness(): Promise<boolean> { try { await this.client.send(new HeadBucketCommand({Bucket:this.bucket})); return true; } catch { return false; } }
  createObjectKey(organizationId: string): string { return `${organizationId}/${crypto.randomUUID()}`; }
  async signedUpload(objectKey:string, contentType:string): Promise<string> { return getSignedUrl(this.client,new PutObjectCommand({Bucket:this.bucket,Key:objectKey,ContentType:contentType}),{expiresIn:300}); }
  async signedRead(objectKey:string): Promise<string> { return getSignedUrl(this.client,new GetObjectCommand({Bucket:this.bucket,Key:objectKey}),{expiresIn:300}); }
}
