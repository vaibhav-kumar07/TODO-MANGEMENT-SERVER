import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { User, UserDocument, UserRole } from '../../users/schemas/user.schema';
import { Team, TeamDocument } from '../../teams/schemas/team.schema';
import { EmailService } from '../email/email.service';

@Injectable()
export class SeedService {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Team.name) private teamModel: Model<TeamDocument>,
    private emailService: EmailService,
  ) {}

  async seedAdmin() {
    try {
      this.logger.log('🚀 Starting admin seeding process...');
      
      // Check if admin already exists
      const existingAdmin = await this.userModel.findOne({ role: UserRole.ADMIN });
      
      if (existingAdmin) {
        this.logger.log('✅ Admin user already exists, skipping seed');
        return;
      }

      this.logger.log('👤 Creating admin user first...');
      // Create admin user first
      const adminPassword = 'Admin123!';
      const hashedPassword = await bcrypt.hash(adminPassword, 12);
      const adminUser = new this.userModel({
        email: 'viranshk7@gmail.com',
        firstName: 'System',
        lastName: 'Administrator',
        password: hashedPassword,
        role: UserRole.ADMIN,
        teamId: null, // Will be updated after team creation
        isEmailVerified: true,
        isActive: true,
        invitedBy: null,
        invitedAt: new Date(),
      });
      await adminUser.save();
      this.logger.log(`✅ Admin user created with ID: ${adminUser._id}`);

      this.logger.log('📝 Creating default team...');
      // Create default team with admin as creator
      const defaultTeam = new this.teamModel({
        name: 'Default Team',
        description: 'Default team created by system',
        createdBy: adminUser._id, // Set admin as creator
        isActive: true,
      });
      const savedTeam = await defaultTeam.save();
      this.logger.log(`✅ Team created with ID: ${savedTeam._id}`);

      // Update admin user with team ID
      await this.userModel.findByIdAndUpdate(adminUser._id, {
        teamId: savedTeam._id,
      });

      // Send admin password email
      try {
        await this.emailService.sendAdminPasswordGenerated(
          adminUser.email,
          adminUser.firstName,
          adminUser.lastName,
          adminPassword,
        );
        this.logger.log('📧 Admin password email sent successfully');
      } catch (emailError) {
        this.logger.error('❌ Failed to send admin password email:', emailError);
      }

      this.logger.log('🎉 Admin user seeded successfully!');
      this.logger.log('📧 Admin credentials:');
      this.logger.log(`   Email: ${adminUser.email}`);
      this.logger.log(`   Password: ${adminPassword}`);
    } catch (error) {
      this.logger.error('❌ Failed to seed admin user:', error);
      this.logger.error('Error stack:', error.stack);
    }
  }

  async generateSecurePassword(): Promise<string> {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    
    // Ensure at least one of each required character type
    password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)]; // Uppercase
    password += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)]; // Lowercase
    password += '0123456789'[Math.floor(Math.random() * 10)]; // Number
    password += '!@#$%^&*'[Math.floor(Math.random() * 8)]; // Special char
    
    // Fill the rest randomly
    for (let i = 4; i < 12; i++) {
      password += chars[Math.floor(Math.random() * chars.length)];
    }
    
    // Shuffle the password
    return password.split('').sort(() => Math.random() - 0.5).join('');
  }
} 