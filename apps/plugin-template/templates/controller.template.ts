import { Controller, Get, Post, Put, Delete, Param, Body, Query, Logger } from '@nestjs/common';
import { {{pascalCase name}}Service } from './{{kebabCase name}}.service';
import { Create{{pascalCase name}}Dto, Update{{pascalCase name}}Dto, {{pascalCase name}}QueryDto } from './dto';

@Controller('{{kebabCase name}}')
export class {{pascalCase name}}Controller {
  private readonly logger = new Logger({{pascalCase name}}Controller.name);

  constructor(private readonly {{camelCase name}}Service: {{pascalCase name}}Service) {}

  @Get()
  async findAll(@Query() query: {{pascalCase name}}QueryDto) {
    this.logger.log('Finding all {{camelCase name}}s');
    
    try {
      const result = await this.{{camelCase name}}Service.findAll(query);
      
      return {
        success: true,
        data: result.data,
        pagination: result.pagination,
      };
    } catch (error) {
      this.logger.error(`Failed to find {{camelCase name}}s: ${error.message}`);
      throw error;
    }
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    this.logger.log(`Finding {{camelCase name}} with id: ${id}`);
    
    try {
      const {{camelCase name}} = await this.{{camelCase name}}Service.findOne(id);
      
      return {
        success: true,
        data: {{camelCase name}},
      };
    } catch (error) {
      this.logger.error(`Failed to find {{camelCase name}} ${id}: ${error.message}`);
      throw error;
    }
  }

  @Post()
  async create(@Body() create{{pascalCase name}}Dto: Create{{pascalCase name}}Dto) {
    this.logger.log(`Creating new {{camelCase name}}`);
    
    try {
      const {{camelCase name}} = await this.{{camelCase name}}Service.create(create{{pascalCase name}}Dto);
      
      return {
        success: true,
        data: {{camelCase name}},
        message: '{{pascalCase name}} created successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to create {{camelCase name}}: ${error.message}`);
      throw error;
    }
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() update{{pascalCase name}}Dto: Update{{pascalCase name}}Dto,
  ) {
    this.logger.log(`Updating {{camelCase name}} with id: ${id}`);
    
    try {
      const {{camelCase name}} = await this.{{camelCase name}}Service.update(id, update{{pascalCase name}}Dto);
      
      return {
        success: true,
        data: {{camelCase name}},
        message: '{{pascalCase name}} updated successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to update {{camelCase name}} ${id}: ${error.message}`);
      throw error;
    }
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    this.logger.log(`Removing {{camelCase name}} with id: ${id}`);
    
    try {
      await this.{{camelCase name}}Service.remove(id);
      
      return {
        success: true,
        message: '{{pascalCase name}} removed successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to remove {{camelCase name}} ${id}: ${error.message}`);
      throw error;
    }
  }

  {{#if includeHealthCheck}}
  @Get('health/check')
  async healthCheck() {
    this.logger.log('{{pascalCase name}} health check');
    
    try {
      const health = await this.{{camelCase name}}Service.healthCheck();
      
      return {
        success: true,
        data: health,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`Health check failed: ${error.message}`);
      throw error;
    }
  }
  {{/if}}

  {{#if includeMetrics}}
  @Get('metrics/stats')
  async getStats() {
    this.logger.log('Getting {{camelCase name}} statistics');
    
    try {
      const stats = await this.{{camelCase name}}Service.getStats();
      
      return {
        success: true,
        data: stats,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`Failed to get stats: ${error.message}`);
      throw error;
    }
  }
  {{/if}}
}