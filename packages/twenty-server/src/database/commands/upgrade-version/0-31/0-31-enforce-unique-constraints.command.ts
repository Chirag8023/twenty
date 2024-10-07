import { InjectRepository } from '@nestjs/typeorm';

import chalk from 'chalk';
import { Command } from 'nest-commander';
import { IsNull, Repository } from 'typeorm';

import {
  ActiveWorkspacesCommandOptions,
  ActiveWorkspacesCommandRunner,
} from 'src/database/commands/active-workspaces.command';
import { Workspace } from 'src/engine/core-modules/workspace/workspace.entity';
import { TwentyORMGlobalManager } from 'src/engine/twenty-orm/twenty-orm-global.manager';

@Command({
  name: 'upgrade-0.31:enforce-unique-constraints',
  description:
    'Enforce unique constraints on company domainName, person emailsPrimaryEmail, ViewField, and ViewSort',
})
export class EnforceUniqueConstraintsCommand extends ActiveWorkspacesCommandRunner {
  constructor(
    @InjectRepository(Workspace, 'core')
    protected readonly workspaceRepository: Repository<Workspace>,
    private readonly twentyORMGlobalManager: TwentyORMGlobalManager,
  ) {
    super(workspaceRepository);
  }

  async executeActiveWorkspacesCommand(
    _passedParam: string[],
    _options: ActiveWorkspacesCommandOptions,
    workspaceIds: string[],
  ): Promise<void> {
    this.logger.log('Running command to enforce unique constraints');

    for (const workspaceId of workspaceIds) {
      this.logger.log(`Running command for workspace ${workspaceId}`);

      try {
        await this.enforceUniqueConstraintsForWorkspace(
          workspaceId,
          _options.dryRun ?? false,
        );

        await this.twentyORMGlobalManager.destroyDataSourceForWorkspace(
          workspaceId,
        );
      } catch (error) {
        this.logger.log(
          chalk.red(
            `Running command on workspace ${workspaceId} failed with error: ${error}`,
          ),
        );
        continue;
      } finally {
        this.logger.log(
          chalk.green(`Finished running command for workspace ${workspaceId}.`),
        );
      }
    }

    this.logger.log(chalk.green(`Command completed!`));
  }

  private async enforceUniqueConstraintsForWorkspace(
    workspaceId: string,
    dryRun: boolean,
  ): Promise<void> {
    await this.enforceUniqueCompanyDomainName(workspaceId, dryRun);
    await this.enforceUniquePersonEmail(workspaceId, dryRun);
    await this.enforceUniqueViewField(workspaceId, dryRun);
    await this.enforceUniqueViewSort(workspaceId, dryRun);
  }

  private async enforceUniqueCompanyDomainName(
    workspaceId: string,
    dryRun: boolean,
  ): Promise<void> {
    const companyRepository =
      await this.twentyORMGlobalManager.getRepositoryForWorkspace(
        workspaceId,
        'company',
      );

    const duplicates = await companyRepository
      .createQueryBuilder('company')
      .select('company.domainNamePrimaryLinkUrl')
      .addSelect('COUNT(*)', 'count')
      .where('company.deletedAt IS NULL')
      .where('company.domainNamePrimaryLinkUrl IS NOT NULL')
      .groupBy('company.domainNamePrimaryLinkUrl')
      .having('COUNT(*) > 1')
      .getRawMany();

    for (const duplicate of duplicates) {
      const { domainNamePrimaryLinkUrl } = duplicate;
      const companies = await companyRepository.find({
        where: { domainNamePrimaryLinkUrl, deletedAt: IsNull() },
        order: { createdAt: 'DESC' },
      });

      for (let i = 1; i < companies.length; i++) {
        const newdomainNamePrimaryLinkUrl = `${domainNamePrimaryLinkUrl}${i}`;

        if (!dryRun) {
          await companyRepository.update(companies[i].id, {
            domainNamePrimaryLinkUrl: newdomainNamePrimaryLinkUrl,
          });
        }
        this.logger.log(
          chalk.yellow(
            `Updated company ${companies[i].id} domainName from ${domainNamePrimaryLinkUrl} to ${newdomainNamePrimaryLinkUrl}`,
          ),
        );
      }
    }
  }

  private async enforceUniquePersonEmail(
    workspaceId: string,
    dryRun: boolean,
  ): Promise<void> {
    const personRepository =
      await this.twentyORMGlobalManager.getRepositoryForWorkspace(
        workspaceId,
        'person',
      );

    const duplicates = await personRepository
      .createQueryBuilder('person')
      .select('person.emailsPrimaryEmail')
      .addSelect('COUNT(*)', 'count')
      .where('person.deletedAt IS NULL')
      .where('person.emailsPrimaryEmail IS NOT NULL')
      .groupBy('person.emailsPrimaryEmail')
      .having('COUNT(*) > 1')
      .getRawMany();

    for (const duplicate of duplicates) {
      const { emailsPrimaryEmail } = duplicate;
      const persons = await personRepository.find({
        where: { emailsPrimaryEmail, deletedAt: IsNull() },
        order: { createdAt: 'DESC' },
      });

      for (let i = 1; i < persons.length; i++) {
        const newEmail = `${emailsPrimaryEmail.split('@')[0]}+${i}@${emailsPrimaryEmail.split('@')[1]}`;

        if (!dryRun) {
          await personRepository.update(persons[i].id, {
            emailsPrimaryEmail: newEmail,
          });
        }
        this.logger.log(
          chalk.yellow(
            `Updated person ${persons[i].id} emailsPrimaryEmail from ${emailsPrimaryEmail} to ${newEmail}`,
          ),
        );
      }
    }
  }

  private async enforceUniqueViewField(
    workspaceId: string,
    dryRun: boolean,
  ): Promise<void> {
    const viewFieldRepository =
      await this.twentyORMGlobalManager.getRepositoryForWorkspace(
        workspaceId,
        'viewField',
      );

    const duplicates = await viewFieldRepository
      .createQueryBuilder('viewField')
      .select(['viewField.fieldMetadataId', 'viewField.viewId'])
      .addSelect('COUNT(*)', 'count')
      .where('viewField.deletedAt IS NULL')
      .groupBy('viewField.fieldMetadataId, viewField.viewId')
      .having('COUNT(*) > 1')
      .getRawMany();

    for (const duplicate of duplicates) {
      const { fieldMetadataId, viewId } = duplicate;
      const viewFields = await viewFieldRepository.find({
        where: { fieldMetadataId, viewId, deletedAt: IsNull() },
        order: { createdAt: 'DESC' },
      });

      for (let i = 1; i < viewFields.length; i++) {
        if (!dryRun) {
          await viewFieldRepository.softDelete(viewFields[i].id);
        }
        this.logger.log(
          chalk.yellow(
            `Soft deleted duplicate ViewField ${viewFields[i].id} for fieldMetadataId ${fieldMetadataId} and viewId ${viewId}`,
          ),
        );
      }
    }
  }

  private async enforceUniqueViewSort(
    workspaceId: string,
    dryRun: boolean,
  ): Promise<void> {
    const viewSortRepository =
      await this.twentyORMGlobalManager.getRepositoryForWorkspace(
        workspaceId,
        'viewSort',
      );

    const duplicates = await viewSortRepository
      .createQueryBuilder('viewSort')
      .select(['viewSort.fieldMetadataId', 'viewSort.viewId'])
      .addSelect('COUNT(*)', 'count')
      .where('viewSort.deletedAt IS NULL')
      .groupBy('viewSort.fieldMetadataId, viewSort.viewId')
      .having('COUNT(*) > 1')
      .getRawMany();

    for (const duplicate of duplicates) {
      const { fieldMetadataId, viewId } = duplicate;
      const viewSorts = await viewSortRepository.find({
        where: { fieldMetadataId, viewId, deletedAt: IsNull() },
        order: { createdAt: 'DESC' },
      });

      for (let i = 1; i < viewSorts.length; i++) {
        if (!dryRun) {
          await viewSortRepository.softDelete(viewSorts[i].id);
        }
        this.logger.log(
          chalk.yellow(
            `Soft deleted duplicate ViewSort ${viewSorts[i].id} for fieldMetadataId ${fieldMetadataId} and viewId ${viewId}`,
          ),
        );
      }
    }
  }
}
