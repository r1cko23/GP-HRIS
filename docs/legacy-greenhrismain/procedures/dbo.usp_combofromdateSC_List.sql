CREATE PROCEDURE [dbo].[usp_combofromdateSC_List] 
	-- Add the parameters for the stored procedure here
		@idclient integer
AS 
BEGIN
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
SET NOCOUNT ON;
	
SELECT DISTINCT  CONVERT(VARCHAR(10), fromdate, 120) AS fromdate1, convert(varchar(10), fromdate, 101) as fromdate2
FROM servicecharge
WHERE idclient = @idclient
ORDER BY fromdate1 DESC;


END