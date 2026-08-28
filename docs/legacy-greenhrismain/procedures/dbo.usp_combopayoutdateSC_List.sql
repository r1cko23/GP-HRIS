CREATE PROCEDURE [dbo].[usp_combopayoutdateSC_List] 
	-- Add the parameters for the stored procedure here
		@idclient integer
AS 
BEGIN
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
SET NOCOUNT ON;
	
SELECT DISTINCT CONVERT(VARCHAR(10), payoutdate, 120) AS payoutdate1, CONVERT(varchar(10), payoutdate, 101) AS payoutdate2
FROM         servicecharge
WHERE     (idclient = @idclient)
ORDER BY payoutdate1 DESC



END