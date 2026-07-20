import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard }           from '../auth/guards/jwt-auth.guard';
import { CurrentUser }            from '../../common/decorators/roles.decorator';
import { SearchService, SearchType } from './search.service';

@ApiTags('Search')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('search')
export class SearchController {
  constructor(private readonly svc: SearchService) {}

  /**
   * Full-text search across contacts, policies, claims, and leads.
   * Uses provider-neutral Prisma filters for names, phone numbers,
   * PAN, and identifier strings.
   */
  @Get()
  @ApiOperation({ summary: 'Global full-text search across all entities' })
  @ApiQuery({ name: 'q',     required: true,  description: 'Search term (min 1 char)' })
  @ApiQuery({ name: 'type',  required: false, enum: ['contacts', 'policies', 'claims', 'leads', 'all'], description: 'Filter by entity type (default: all)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Max results per entity (default: 10, max: 50)' })
  search(
    @CurrentUser() user: any,
    @Query('q')     q:      string,
    @Query('type')  type?:  SearchType,
    @Query('limit') limit?: string,
  ) {
    return this.svc.search(
      user.tenantId,
      user.userId,
      user.role,
      q,
      type as any,
      Number(limit)
    );
  }

  /**
   * Fast autocomplete suggestions — returns up to 5 contact name + phone matches.
   * Optimised for search-as-you-type with Prisma string filters.
   */
  @Get('suggestions')
  @ApiOperation({ summary: 'Autocomplete suggestions (contacts, fast prefix search)' })
  @ApiQuery({ name: 'q',     required: true })
  @ApiQuery({ name: 'limit', required: false, description: 'Max suggestions (default: 5, max: 10)' })
  suggestions(
    @CurrentUser() user: any,
    @Query('q')     q:      string,
    @Query('limit') limit?: string,
  ) {
    return this.svc.suggestions(user.tenantId, q, limit ? parseInt(limit, 10) : 5);
  }
}
