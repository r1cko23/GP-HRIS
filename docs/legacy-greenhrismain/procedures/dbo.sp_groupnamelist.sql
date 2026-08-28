create PROCEDURE [dbo].[sp_groupnamelist] 
	-- Add the parameters for the stored procedure here
		--@idclient integer
		@idbranch integer
AS 
BEGIN
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;
	
SELECT 	 groupname
FROM     client_branch_position
where idclientbranch = @idbranch
order by groupname asc


END