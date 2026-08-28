CREATE PROCEDURE [dbo].[sp_backup_full]
	@DbName NVARCHAR(128)= 'HRISMAIN',
	@BackupPath NVARCHAR(256) = 'C:\Backups\Data\'
AS
	DECLARE @BackupCommand NVARCHAR(MAX);
	SET @BackupPath = @BackupPath + @DbName + '_Full_' + REPLACE(CONVERT(VARCHAR(19), GETDATE(), 120), ':', '-') + '.bak';

	SET @BackupCommand = 
			'BACKUP DATABASE [' + @DbName + '] ' +
			'TO DISK = ''' + @BackupPath + ''' ' +
			'WITH INIT, NAME = ''Full Backup of [' + @DbName + ']'', FORMAT';

	EXEC sp_executesql @BackupCommand;
