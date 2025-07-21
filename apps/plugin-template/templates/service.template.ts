import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
{{#if useDatabase}}
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindManyOptions } from 'typeorm';
import { {{pascalCase name}}Entity } from './entities/{{kebabCase name}}.entity';
{{/if}}
{{#if useCache}}
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { Inject } from '@nestjs/common';
{{/if}}
import { Create{{pascalCase name}}Dto, Update{{pascalCase name}}Dto, {{pascalCase name}}QueryDto } from './dto';
import { {{pascalCase name}}Interface } from './interfaces/{{kebabCase name}}.interface';

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

@Injectable()
export class {{pascalCase name}}Service {
  private readonly logger = new Logger({{pascalCase name}}Service.name);
  {{#unless useDatabase}}
  private readonly {{camelCase name}}s = new Map<string, {{pascalCase name}}Interface>();
  {{/unless}}

  constructor(
    {{#if useDatabase}}
    @InjectRepository({{pascalCase name}}Entity)
    private readonly {{camelCase name}}Repository: Repository<{{pascalCase name}}Entity>,
    {{/if}}
    {{#if useCache}}
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
    {{/if}}
  ) {}

  async findAll(query: {{pascalCase name}}QueryDto): Promise<PaginatedResult<{{pascalCase name}}Interface>> {
    try {
      const { page = 1, limit = 10, search, sortBy = 'createdAt', sortOrder = 'DESC' } = query;
      const skip = (page - 1) * limit;

      {{#if useCache}}
      const cacheKey = `{{camelCase name}}s:${JSON.stringify(query)}`;
      const cached = await this.cacheManager.get<PaginatedResult<{{pascalCase name}}Interface>>(cacheKey);
      
      if (cached) {
        this.logger.debug(`Cache hit for {{camelCase name}}s query`);
        return cached;
      }
      {{/if}}

      {{#if useDatabase}}
      const options: FindManyOptions<{{pascalCase name}}Entity> = {
        skip,
        take: limit,
        order: { [sortBy]: sortOrder },
      };

      if (search) {
        options.where = [
          { name: Like(`%${search}%`) },
          { description: Like(`%${search}%`) },
        ];
      }

      const [data, total] = await this.{{camelCase name}}Repository.findAndCount(options);
      {{else}}
      let data = Array.from(this.{{camelCase name}}s.values());

      // Apply search filter
      if (search) {
        data = data.filter(item => 
          item.name?.toLowerCase().includes(search.toLowerCase()) ||
          item.description?.toLowerCase().includes(search.toLowerCase())
        );
      }

      // Apply sorting
      data.sort((a, b) => {
        const aValue = a[sortBy];
        const bValue = b[sortBy];
        
        if (sortOrder === 'ASC') {
          return aValue > bValue ? 1 : -1;
        } else {
          return aValue < bValue ? 1 : -1;
        }
      });

      const total = data.length;
      data = data.slice(skip, skip + limit);
      {{/if}}

      const totalPages = Math.ceil(total / limit);
      
      const result: PaginatedResult<{{pascalCase name}}Interface> = {
        data,
        pagination: {
          total,
          page,
          limit,
          totalPages,
          hasNext: page < totalPages,
          hasPrevious: page > 1,
        },
      };

      {{#if useCache}}
      await this.cacheManager.set(cacheKey, result, 300000); // 5 minutes
      {{/if}}

      this.logger.log(`Found ${data.length} {{camelCase name}}s (total: ${total})`);
      return result;

    } catch (error) {
      this.logger.error(`Failed to find {{camelCase name}}s: ${error.message}`);
      throw error;
    }
  }

  async findOne(id: string): Promise<{{pascalCase name}}Interface> {
    try {
      {{#if useCache}}
      const cacheKey = `{{camelCase name}}:${id}`;
      const cached = await this.cacheManager.get<{{pascalCase name}}Interface>(cacheKey);
      
      if (cached) {
        this.logger.debug(`Cache hit for {{camelCase name}} ${id}`);
        return cached;
      }
      {{/if}}

      {{#if useDatabase}}
      const {{camelCase name}} = await this.{{camelCase name}}Repository.findOne({ where: { id } });
      {{else}}
      const {{camelCase name}} = this.{{camelCase name}}s.get(id);
      {{/if}}

      if (!{{camelCase name}}) {
        throw new NotFoundException(`{{pascalCase name}} with id ${id} not found`);
      }

      {{#if useCache}}
      await this.cacheManager.set(cacheKey, {{camelCase name}}, 300000); // 5 minutes
      {{/if}}

      this.logger.log(`Found {{camelCase name}} with id: ${id}`);
      return {{camelCase name}};

    } catch (error) {
      this.logger.error(`Failed to find {{camelCase name}} ${id}: ${error.message}`);
      throw error;
    }
  }

  async create(create{{pascalCase name}}Dto: Create{{pascalCase name}}Dto): Promise<{{pascalCase name}}Interface> {
    try {
      this.logger.log(`Creating {{camelCase name}}: ${create{{pascalCase name}}Dto.name}`);

      {{#if useDatabase}}
      const {{camelCase name}} = this.{{camelCase name}}Repository.create({
        ...create{{pascalCase name}}Dto,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const saved{{pascalCase name}} = await this.{{camelCase name}}Repository.save({{camelCase name}});
      {{else}}
      const {{camelCase name}}: {{pascalCase name}}Interface = {
        id: this.generateId(),
        ...create{{pascalCase name}}Dto,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      this.{{camelCase name}}s.set({{camelCase name}}.id, {{camelCase name}});
      const saved{{pascalCase name}} = {{camelCase name}};
      {{/if}}

      {{#if useCache}}
      await this.cacheManager.del(`{{camelCase name}}s:*`); // Invalidate list cache
      {{/if}}

      this.logger.log(`Created {{camelCase name}} with id: ${saved{{pascalCase name}}.id}`);
      return saved{{pascalCase name}};

    } catch (error) {
      this.logger.error(`Failed to create {{camelCase name}}: ${error.message}`);
      throw error;
    }
  }

  async update(id: string, update{{pascalCase name}}Dto: Update{{pascalCase name}}Dto): Promise<{{pascalCase name}}Interface> {
    try {
      const existing{{pascalCase name}} = await this.findOne(id);

      {{#if useDatabase}}
      await this.{{camelCase name}}Repository.update(id, {
        ...update{{pascalCase name}}Dto,
        updatedAt: new Date(),
      });

      const updated{{pascalCase name}} = await this.{{camelCase name}}Repository.findOne({ where: { id } });
      {{else}}
      const updated{{pascalCase name}} = {
        ...existing{{pascalCase name}},
        ...update{{pascalCase name}}Dto,
        updatedAt: new Date(),
      };

      this.{{camelCase name}}s.set(id, updated{{pascalCase name}});
      {{/if}}

      {{#if useCache}}
      await this.cacheManager.del(`{{camelCase name}}:${id}`);
      await this.cacheManager.del(`{{camelCase name}}s:*`); // Invalidate list cache
      {{/if}}

      this.logger.log(`Updated {{camelCase name}} with id: ${id}`);
      return updated{{pascalCase name}}!;

    } catch (error) {
      this.logger.error(`Failed to update {{camelCase name}} ${id}: ${error.message}`);
      throw error;
    }
  }

  async remove(id: string): Promise<void> {
    try {
      await this.findOne(id); // Verify exists

      {{#if useDatabase}}
      await this.{{camelCase name}}Repository.delete(id);
      {{else}}
      this.{{camelCase name}}s.delete(id);
      {{/if}}

      {{#if useCache}}
      await this.cacheManager.del(`{{camelCase name}}:${id}`);
      await this.cacheManager.del(`{{camelCase name}}s:*`); // Invalidate list cache
      {{/if}}

      this.logger.log(`Removed {{camelCase name}} with id: ${id}`);

    } catch (error) {
      this.logger.error(`Failed to remove {{camelCase name}} ${id}: ${error.message}`);
      throw error;
    }
  }

  {{#if includeHealthCheck}}
  async healthCheck(): Promise<{ status: string; timestamp: Date; details?: any }> {
    try {
      {{#if useDatabase}}
      // Check database connection
      await this.{{camelCase name}}Repository.query('SELECT 1');
      {{/if}}
      
      {{#if useCache}}
      // Check cache connection
      await this.cacheManager.get('health-check');
      {{/if}}

      return {
        status: 'healthy',
        timestamp: new Date(),
        details: {
          {{#if useDatabase}}
          database: 'connected',
          {{/if}}
          {{#if useCache}}
          cache: 'connected',
          {{/if}}
          {{#unless useDatabase}}
          memoryStore: `${this.{{camelCase name}}s.size} items`,
          {{/unless}}
        },
      };

    } catch (error) {
      this.logger.error(`Health check failed: ${error.message}`);
      
      return {
        status: 'unhealthy',
        timestamp: new Date(),
        details: {
          error: error.message,
        },
      };
    }
  }
  {{/if}}

  {{#if includeMetrics}}
  async getStats(): Promise<{
    total: number;
    createdToday: number;
    updatedToday: number;
    averageCreationTime?: number;
  }> {
    try {
      {{#if useDatabase}}
      const total = await this.{{camelCase name}}Repository.count();
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const createdToday = await this.{{camelCase name}}Repository.count({
        where: {
          createdAt: MoreThanOrEqual(today),
        },
      });
      
      const updatedToday = await this.{{camelCase name}}Repository.count({
        where: {
          updatedAt: MoreThanOrEqual(today),
        },
      });
      {{else}}
      const all{{pascalCase name}}s = Array.from(this.{{camelCase name}}s.values());
      const total = all{{pascalCase name}}s.length;
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const createdToday = all{{pascalCase name}}s.filter(
        item => item.createdAt >= today
      ).length;
      
      const updatedToday = all{{pascalCase name}}s.filter(
        item => item.updatedAt >= today
      ).length;
      {{/if}}

      return {
        total,
        createdToday,
        updatedToday,
      };

    } catch (error) {
      this.logger.error(`Failed to get stats: ${error.message}`);
      throw error;
    }
  }
  {{/if}}

  {{#unless useDatabase}}
  private generateId(): string {
    return `{{camelCase name}}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  }
  {{/unless}}
}