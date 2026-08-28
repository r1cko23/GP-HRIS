CREATE PROCEDURE [dbo].[sp_backup_transaction_log]
	@DbName NVARCHAR(128)= 'HRISMAIN',
	@BackupPath NVARCHAR(256) = 'C:\Backups\Data\'
AS
DECLARE @BackupCommand NVARCHAR(MAX);

SET @BackupPath = @BackupPath + @DbName + '_TransactionLog_' + REPLACE(CONVERT(VARCHAR(19), GETDATE(), 120), ':', '-') + '.trn';

SET @BackupCommand = 
    'BACKUP LOG [' + @DbName + '] ' +
    'TO DISK = ''' + @BackupPath + ''' ' +
    'WITH NAME = ''Transaction Log Backup of [' + @DbName + ']'', FORMAT';

EXEC sp_executesql @BackupCommand;
