import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { BasePluginTemplate } from '../base/plugin.template';
import { CreateDto, UpdateDto, QueryDto } from './dto';

export abstract class RestApiPluginTemplate extends BasePluginTemplate {
  protected abstract readonly resourceName: string;
  protected abstract readonly basePath: string;

  protected async onInitialize(): Promise<void> {
    this.logger.log(`REST API plugin for ${this.resourceName} initialized`);
  }

  protected async onDestroy(): Promise<void> {
    this.logger.log(`REST API plugin for ${this.resourceName} destroyed`);
  }

  protected async getHealthChecks() {
    return [
      {
        name: 'rest-endpoints',
        status: 'pass',
        message: `REST endpoints for ${this.resourceName} are healthy`
      }
    ];
  }

  abstract getController(): any;
}

export function createRestController(pluginTemplate: RestApiPluginTemplate) {
  @Controller(pluginTemplate.basePath)
  @ApiTags(pluginTemplate.resourceName)
  class DynamicRestController {
    constructor(private readonly plugin: RestApiPluginTemplate) {}

    @Get()
    @ApiOperation({ summary: `Get all ${pluginTemplate.resourceName}` })
    @ApiResponse({ status: 200, description: 'Success' })
    async findAll(@Query() query: QueryDto) {
      return this.plugin['findAll'](query);
    }

    @Get(':id')
    @ApiOperation({ summary: `Get ${pluginTemplate.resourceName} by ID` })
    @ApiResponse({ status: 200, description: 'Success' })
    @ApiResponse({ status: 404, description: 'Not found' })
    async findOne(@Param('id') id: string) {
      return this.plugin['findOne'](id);
    }

    @Post()
    @ApiOperation({ summary: `Create ${pluginTemplate.resourceName}` })
    @ApiResponse({ status: 201, description: 'Created' })
    @ApiResponse({ status: 400, description: 'Bad request' })
    async create(@Body() createDto: CreateDto) {
      return this.plugin['create'](createDto);
    }

    @Put(':id')
    @ApiOperation({ summary: `Update ${pluginTemplate.resourceName}` })
    @ApiResponse({ status: 200, description: 'Updated' })
    @ApiResponse({ status: 404, description: 'Not found' })
    async update(@Param('id') id: string, @Body() updateDto: UpdateDto) {
      return this.plugin['update'](id, updateDto);
    }

    @Delete(':id')
    @ApiOperation({ summary: `Delete ${pluginTemplate.resourceName}` })
    @ApiResponse({ status: 200, description: 'Deleted' })
    @ApiResponse({ status: 404, description: 'Not found' })
    async remove(@Param('id') id: string) {
      return this.plugin['remove'](id);
    }
  }

  return DynamicRestController;
}