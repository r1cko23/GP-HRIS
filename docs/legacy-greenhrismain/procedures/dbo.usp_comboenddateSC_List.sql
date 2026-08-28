CREATE PROCEDURE [dbo].[usp_comboenddateSC_List] 
	-- Add the parameters for the stored procedure here
		@idclient integer
AS 
BEGIN
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
SET NOCOUNT ON;
	
SELECT DISTINCT CONVERT(VARCHAR(10), enddate, 120) AS enddate1, convert(varchar(10), enddate, 101) as enddate2
FROM servicecharge
WHERE idclient = @idclient
ORDER BY enddate1 DESC;


END