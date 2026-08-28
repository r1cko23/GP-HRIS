create PROCEDURE [dbo].[usp_combocuttoff_Listtk] 
	-- Add the parameters for the stored procedure here
		@idclient integer
AS 
BEGIN
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;
	
 SELECT DISTINCT datestart, CONVERT(VARCHAR, datestart, 101) + ' To ' + CONVERT(VARCHAR, dateend, 101) AS cuttoff
    FROM tbl_timekeep  
	WHERE idclient = @idclient
	order by datestart desc

END