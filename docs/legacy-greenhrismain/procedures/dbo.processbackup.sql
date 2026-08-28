-- =============================================
-- Author:		<Pat Relos>
-- Create date: <2-2-2024>
-- Description:	<Backup database>
-- =============================================
CREATE PROCEDURE  [dbo].[processbackup]
	-- Add the parameters for the stored procedure here
		 @destination nvarchar(150),
		 @dbname nvarchar(150)
		
AS
BEGIN
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;

	DECLARE @BackupPath NVARCHAR(255)
	--Specify the path where you want to store the backup file
	SET @BackupPath = @destination+'\'
	
	--Formatting the backupname indicate the date time of backfile
    DECLARE @BackupFileName NVARCHAR(255)
    SET @BackupFileName = @BackupPath + @dbname + REPLACE(CONVERT(NVARCHAR(30), format(GETDATE(), ' yyyy-MM-dd hh:mm:ss tt')), ':', '') + '.bak'

  --Final Process of backup command and set to its destination(Using Full Backup)
    BACKUP DATABASE @dbname
    TO DISK = @BackupFileName
    WITH FORMAT, INIT, NAME = 'Full Database Backup';

	--update the talble to monitor the last backup date	
	UPDATE backupdefault SET destination=@destination
	,datelastbackup = CONVERT(NVARCHAR(30), format(GETDATE(), ' yyyy-MM-dd hh:mm:ss tt'))
	where idbackup =1                                    

END

